<?php
/**
 * vim: tabstop=4
 *
 * @license    http://www.gnu.org/licenses/gpl.html GPL Version 3
 * @author     Ian Moore <imooreyahoo@gmail.com>
 * @copyright  Copyright (c) 2010-2012 Ian Moore
 *
 * This file is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This file is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this file. If not, see <http://www.gnu.org/licenses/>.
 *
 */

require_once("openmediavault/object.inc");
require_once("openmediavault/error.inc");
require_once("openmediavault/util.inc");
require_once("openmediavault/rpc.inc");
require_once("openmediavault/notify.inc");

require_once("/usr/share/phpvirtualbox/lib/config.php");
require_once("/usr/share/phpvirtualbox/lib/utils.php");
require_once("/usr/share/phpvirtualbox/lib/vboxconnector.php");

class VirtualBoxRpc extends OMVRpc {

	const xpathRoot = '//services/virtualbox';

	public function __construct()
	{

		$this->methodSchemata = array(

			"set"             => array(
				'{
				"type":"object",
				"properties":{
					"enable":{"type":"boolean"},
					"enable-advanced":{"type":"boolean"},
					"vm-folder":{"type":"string","optional":true},
					"mntentref":{' . $GLOBALS['OMV_JSONSCHEMA_UUID'] . '}
				}
			}'
			),
			"getMachines"     => array(
				'{"type":"integer"}', // start
				'{"type":"integer"}', // count
				'{' . $GLOBALS['OMV_JSONSCHEMA_SORTFIELD'] . '}', // sortField
				'{' . $GLOBALS['OMV_JSONSCHEMA_SORTDIR'] . '}' // sortDir
			),
			"setMachine"      => array(
				'{
				"type":"object",
				"properties":{
					"uuid":{"type":"string","format":"regex","pattern":"\/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$\/i"},
					"name":{"type":"string","optional":true},
					"startupMode":{"type":"string","enum":["auto","manual"]}
				}
			}'
			),
			"getMachine"      => array(
				'
				{"type":"string","format":"regex","pattern":"\/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$\/i"}
			'
			),

			"setMachineState" => array(
				'{
				"type":"object",
				"properties": {
                	"uuid":{"type":"string","format":"regex","pattern":"\/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$\/i"},
					"state":{"type":"string"}
				}
			
            }'
			)

		);
	}

	/**
	 * Safe config getting
	 */
	public function __call($name, $args)
	{

		// Configuration methods
		if (substr($name, 0, 6) == 'config')
		{

			// Correct method name
			$name    = substr($name, 6);
			$name[0] = strtolower($name[0]);

			global $xmlConfig;
			$object = call_user_func_array(array($xmlConfig, $name), $args);
			if (is_null($object))
			{
				switch ($name)
				{
					case 'delete':
						throw new OMVException(OMVErrorMsg::E_CONFIG_OBJECT_NOT_FOUND, $args[0]);
						break;
					case 'save':
						throw new OMVException(OMVErrorMsg::E_CONFIG_SAVE_FAILED, $xmlConfig->getError());
						break;
					case 'set':
					case 'replace':
						throw new OMVException(OMVErrorMsg::E_CONFIG_SET_OBJECT_FAILED);
						break;
					default:
						throw new OMVException(OMVErrorMsg::E_CONFIG_GET_OBJECT_FAILED, $args[0]);
				}
			}

			return $object;

		}

		throw new Exception("Method " . __CLASS__ . "::" . $name . " does not exist.");
	}

	/**
	 * Validate admin user and function args
	 */
	function _validate($mname = '', $args = array())
	{

		// Check permissions
		$this->validateSession();
		if (! $this->hasRole(OMV_ROLE_ADMINISTRATOR))
		{
			throw new OMVException(OMVErrorMsg::E_RPC_SERVICE_INVALID_PERMISSION);
		}
		$this->commitSession();

		// Check incoming data
		if ($mname)
		{
			$this->validateParams($mname, $args);
		}

	}

	/**
	 * Exception handler that ignores NOTICES
	 */
	function ignore_notice($errno, $errstr, $errfile, $errline)
	{
		return;
	}

	/**
	 * Get configuration object.
	 */
	function get()
	{

		// Validation
		$this->_validate();

		//Get configuration object
		$object = $this->configGet(self::xpathRoot);

		// Modify result data
		$object['enable']          = boolval($object['enable']);
		$object['enable-advanced'] = boolval($object['enable-advanced']);
		return $object;
	}

	/**
	 * Set configuration object.
	 */
	function set($data)
	{

		// Validation
		$this->_validate(__METHOD__, func_get_args());

		// Parent dir
		$pdir = sprintf("//system/fstab/mntent[uuid='%s']", $data['mntentref']);
		$pdir = $this->configGet($pdir);
		$pdir = $pdir['dir'];

		$data['vm-folder'] = "{$pdir}/virtualbox-machines";

		// Prepare configuration data
		$econf = $this->get();

		// Create machine root
		if ($econf['vm-folder'] != $data['vm-folder'])
		{

			// Get vbox user
			$out = array();
			exec('sudo /bin/sh -c \'. /etc/default/openmediavault; OMV_VBOX_USER=${OMV_VBOX_USER:-"vbox"}; echo ${OMV_VBOX_USER}\'', $out);
			$vboxUser = $out[0];

			// Ultimately files / folders must be readable / writable by vbox user.
			$cmd = "sudo /bin/sh -c '[ -d {$data['vm-folder']} ] || /bin/mkdir -p {$data['vm-folder']}; chown {$vboxUser} {$data['vm-folder']}; chmod u+rwx {$data['vm-folder']}'";
			OMVUtil::exec($cmd, $output, $result);
			if ($result !== 0)
			{
				throw new OMVException(OMVErrorMsg::E_EXEC_FAILED, $cmd, implode("\n", $output));
			}

		}

		$object = array(
			"enable"          => array_boolval($data, 'enable'),
			"enable-advanced" => array_boolval($data, 'enable-advanced'),
			"vm-folder"       => $data['vm-folder'],
			"mntentref"       => $data['mntentref']
		);

		// Set configuration object
		$this->configReplace(self::xpathRoot, $object);

		$this->configSave();

		// Notify general configuration changes
		$dispatcher = &OMVNotifyDispatcher::getInstance();
		$dispatcher->notify(OMV_NOTIFY_MODIFY,
												"org.openmediavault.services.virtualbox", $object);

	}


	/**
	 * Get list of machine objects.
	 */
	public function getMachines($start, $count, $sortField, $sortDir)
	{

		// Validation
		$this->_validate(__METHOD__, func_get_args());

		// Get objects
		$objects = array();
		set_error_handler(array($this, 'ignore_notice'), E_NOTICE);
		$vb                   = new vboxconnector();
		$vb->skipSessionCheck = true;
		$vb->connect();
		foreach ($vb->vbox->machines as $m)
		{
			$objects[] = array(
				'uuid'         => $m->id,
				'name'         => $m->name,
				'state'        => $m->state->__toString(),
				'OSTypeId'     => $m->getOSTypeId(),
				'sessionState' => $m->sessionState->__toString(),
				'startupMode'  => $m->getExtraData('pvbx/startupMode')
			);
		}
		unset($vb); // calls __destroy() which may cause E_NOTICEs
		restore_error_handler();

		// Filter result
		return $this->applyFilter($objects, $start, $count, $sortField, $sortDir);

	}

	/*
	 * Save machine info
	*/
	public function setMachine($data)
	{

		// Validation
		$this->_validate(__METHOD__, func_get_args());

		set_error_handler(array($this, 'ignore_notice'), E_NOTICE);

		$vb                   = new vboxconnector();
		$vb->skipSessionCheck = true;
		$vb->connect();

		$machine   = $vb->vbox->findMachine($data['uuid']);
		$vmRunning = ($machine->state->__toString() == 'Running');

		$vb->session = $vb->websessionManager->getSessionObject($vb->vbox->handle);
		$machine->lockMachine($vb->session->handle, ($vmRunning ? 'Shared' : 'Write'));

		$m = &$vb->session->machine;

		if (! $vmRunning && isset($data['name']) && ! empty($data['name']) && $m->name != $data['name'])
		{
			$m->name = $data['name'];
			$vb->cache->expire('_machineGetDetails' . $data['uuid']);
		}

		$m->setExtraData('pvbx/startupMode', $data['startupMode']);

		$vb->session->machine->saveSettings();
		$vb->session->unlockMachine();
		$vb->session->releaseRemote();
		unset($vb->session);
		unset($vb); // calls __destroy() which may cause E_NOTICEs
		restore_error_handler();

	}

	/**
	 * Get a single machine's configuration
	 */
	public function getMachine($uuid)
	{

		// Validation
		$this->_validate(__METHOD__, func_get_args());

		// get existing machine
		$object = array();
		set_error_handler(array($this, 'ignore_notice'), E_NOTICE);
		$vb                   = new vboxconnector();
		$vb->skipSessionCheck = true;
		$vb->connect();
		$m      = $vb->vbox->findMachine($uuid);
		$object = array(
			'uuid'         => $m->id,
			'name'         => $m->name,
			'state'        => $m->state->__toString(),
			'OSTypeId'     => $m->getOSTypeId(),
			'sessionState' => $m->sessionState->__toString(),
			'startupMode'  => $m->getExtraData('pvbx/startupMode')
		);
		unset($vb); // calls __destroy() which may cause E_NOTICEs
		restore_error_handler();

		return $object;
	}

	/**
	 * Set the state of a vm (running, stop, pause, etc..)
	 */
	public function setMachineState($data)
	{

		// Validation
		$this->_validate(__METHOD__, func_get_args());

		set_error_handler(array($this, 'ignore_notice'), E_NOTICE);
		$vb                   = new vboxconnector();
		$vb->skipSessionCheck = true;
		$args                 = array('vm'   => $data['uuid'],
																	'state'=> $data['state']
		);
		$response             = array();
		$vb->machineSetState($args, array(&$response));
		unset($vb); // calls __destroy() which may cause E_NOTICEs
		restore_error_handler();

		return $response['data'];

	}
}
