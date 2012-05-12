<?php
/**
 * @license   http://www.gnu.org/licenses/gpl.html GPL Version 3
 * @author    Ian Moore <imooreyahoo@gmail.com>
 * @copyright Copyright (c) 2010-2012 Ian Moore
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
 */
require_once("openmediavault/module.inc");
require_once("openmediavault/config.inc");
require_once("openmediavault/error.inc");
require_once("openmediavault/util.inc");
require_once("openmediavault/initscript.inc");

class VirtualBoxModule extends OMVModuleAbstract implements OMVINotifyListener, OMVIModuleStatus {

	/**
	 * Get the module name.
	 */
	public static function getName()
	{
		return "virtualbox";
	}

	/**
	 * Get the module status.
	 */
	public function getStatus()
	{

		global $xmlConfig;

		// Get the configuration object
		$xpath  = "//services/virtualbox";
		$object = $xmlConfig->get($xpath);
		if (is_null($object))
		{
			throw new OMVException(OMVErrorMsg::E_CONFIG_GET_OBJECT_FAILED, $xpath);
		}

		// This is the best I could do
		$cmd = sprintf("sudo /etc/init.d/vboxweb-service status");
		OMVUtil::exec($cmd, $output, $result);
		return array(
			"name"    => $this->getName(),
			"title"   => gettext("VirtualBox Web Service"),
			"enabled" => boolval($object['enable']),
			"running" => (strpos($output[0], '...running') > 0)
		);
	}

	/**
	 * Update the service.
	 */
	public function updateService()
	{

		global $xmlConfig;

		// Get the configuration object
		$xpath = "//services/virtualbox";
		if (is_null($object = $xmlConfig->get($xpath)))
		{
			throw new OMVException(OMVErrorMsg::E_CONFIG_GET_OBJECT_FAILED, $xpath);
		}

		// Reconfigure
		$cmd = "sudo omv-mkconf virtualbox 2>&1";
		OMVUtil::exec($cmd, $output, $result);
		if ($result !== 0)
		{
			throw new OMVException(OMVErrorMsg::E_EXEC_FAILED, $cmd, implode("\n", $output));
		}

	}

	/**
	 * Bind listeners.
	 */
	function bindListeners(OMVNotifyDispatcher $dispatcher)
	{

		// Update service if configuration has been modified
		$dispatcher->addListener(OMV_NOTIFY_MODIFY, "org.openmediavault.services.virtualbox", array($this, "updateService"), 1);

	}

}

// Register module
$moduleMgr = &OMVModuleMgr::getInstance();
$moduleMgr->registerModule(new VirtualBoxModule());
