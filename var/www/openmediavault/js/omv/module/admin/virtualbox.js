/**
 * vim: tabstop=4:
 *
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
//require("js/omv/NavigationPanel.js")
//require("js/omv/data/DataProxy.js")
//require("js/omv/FormPanelExt.js")
//require("js/omv/form/PasswordField.js")
//require("js/omv/form/SharedFolderComboBox.js")
//require("js/omv/form/plugins/FieldInfo.js")

Ext.ns("OMV.Module.Services");

//Register the menu.
OMV.NavigationPanelMgr.registerMenu("services", "virtualbox", {
	text:_("VirtualBox"),
	icon:"images/virtualbox.png"
});

OMV.Module.Services.vboxSettingsPanel = function (config) {
	var initialConfig = {
		rpcService:"VirtualBox"
	};
	Ext.apply(initialConfig, config);
	OMV.Module.Services.vboxSettingsPanel.superclass.constructor.call(this, initialConfig);
};

Ext.extend(OMV.Module.Services.vboxSettingsPanel, OMV.FormPanelExt, {
	initComponent:function () {

		OMV.Module.Services.vboxSettingsPanel.superclass.initComponent.apply(this, arguments);

		this.on("load", this._updateFormFields, this);
		this.on("load", function () {

			// Disable machines tab?
			var checked = this.findFormField("enable").checked;
			var rp = this.ownerCt.find('title', _('Virtual Machines'));
			if (rp.length > 0)
				(checked ? rp[0].enable() : rp[0].disable());

		}, this);
	},

	getFormItems:function () {

		return [
			{
				xtype   :"fieldset",
				title   :_("General settings"),
				defaults:{
					labelSeparator:""
				},
				items   :[
					{
						xtype     :"checkbox",
						name      :"enable",
						fieldLabel:_("Enable"),
						checked   :false,
						inputValue:1,
						listeners :{
							check:this._updateFormFields,
							scope:this
						}
					},
					{
						xtype        :"combo",
						name         :"mntentref",
						hiddenName   :"mntentref",
						fieldLabel   :_("Virtual Machine Volume"),
						emptyText    :_("Select a volume ..."),
						allowBlank   :false,
						allowNone    :false,
						width        :400,
						editable     :false,
						triggerAction:"all",
						displayField :"description",
						valueField   :"uuid",
						store        :new OMV.data.Store({
							remoteSort:false,
							proxy     :new OMV.data.DataProxy({"service":"ShareMgmt", "method":"getCandidates"}),
							reader    :new Ext.data.JsonReader({
								idProperty:"uuid",
								fields    :[
									{ name:"uuid" },
									{ name:"description" }
								]
							})
						})
					},
					{
						xtype     :"textfield",
						name      :"vm-folder",
						fieldLabel:_("Virtual Machine Folder"),
						allowNone :true,
						readOnly  :true,
						hiddenName:"vm-folder",
						width     :400
					}
				]
			},
			{
				xtype   :"fieldset",
				title   :_("phpVirtualBox"),
				defaults:{
					labelSeparator:""
				},
				items   :[
					{
						xtype     :"checkbox",
						name      :"enable-advanced",
						fieldLabel:_("Advanced Config"),
						checked   :false,
						inputValue:1,
						plugins   :[ OMV.form.plugins.FieldInfo ],
						infoText  :_("Show advanced configuration options in phpVirtualBox web interface.")
					}
				]
			}
		];
	},

	/**
	 * Private function to update the states of various form fields.
	 */
	_updateFormFields:function () {
		// Enabled / disabled fields
		var field = this.findFormField("enable");
		var checked = field.checked;
		var fields = [ "enable-advanced", "mntentref"];
		for (var i = 0; i < fields.length; i++) {
			field = this.findFormField(fields[i]);
			if (!Ext.isEmpty(field)) {
				field.allowBlank = !checked;
				field.setReadOnly(!checked);
			}
		}
	}
});

OMV.Module.Services.vboxMachinesGridPanel = function (config) {

	var initialConfig = {
		disabled         :true,
		hidePagingToolbar:true,
		hideAdd          :true,
		hideEdit         :true,
		hideDelete       :true,
		autoReload       :true,

		colModel:new Ext.grid.ColumnModel({
			columns:[
				{
					header   :_("Virtual Machine"),
					sortable :true,
					dataIndex:"name",
					renderer :this.vmRenderer
				},
				{
					header   :_("State"),
					sortable :true,
					dataIndex:"state",
					renderer :this.stateRenderer
				},
				{
					header   :_("Startup Mode"),
					sortable :true,
					dataIndex:"startupMode",
					renderer :this.startModeRenderer
				}
			]
		})
	};
	Ext.apply(initialConfig, config);
	OMV.Module.Services.vboxMachinesGridPanel.superclass.constructor.call(this, initialConfig);
};

Ext.extend(OMV.Module.Services.vboxMachinesGridPanel, OMV.grid.TBarGridPanel, {

	initComponent:function () {
		this.store = new OMV.data.Store({
			autoLoad  :false,
			remoteSort:false,
			proxy     :new OMV.data.DataProxy({"service":"virtualbox", "method":"getMachines"}),
			reader    :new Ext.data.JsonReader({
				idProperty   :"uuid",
				totalProperty:"total",
				root         :"data",
				fields       :[
					{ name:"uuid" },
					{ name:"OSTypeId" },
					{ name:"state" },
					{ name:"startupMode" },
					{ name:"sessionState" },
					{ name:"name" }
				]
			})
		});
		OMV.Module.Services.vboxMachinesGridPanel.superclass.initComponent.apply(this, arguments);

		this.store.on("beforeload", function (store, options) {
			var sm = this.getSelectionModel();
			var records = sm.getSelections();
			sm.previousSelections = [];
			Ext.each(records, function (record, index) {
				sm.previousSelections.push(record.get("uuid"));
			}, this);
		}, this);
		this.store.on("load", function (store, records, options) {
			var sm = this.getSelectionModel();
			var rows = [];
			if (Ext.isDefined(sm.previousSelections)) {
				for (var i = 0; i < sm.previousSelections.length; i++) {
					var index = store.findExact("uuid",
									sm.previousSelections[i]);
					if (index !== -1) {
						rows.push(index);
					}
				}
			}
			if (rows.length > 0) {
				sm.selectRows(rows);
			}
		}, this);

	},

	// Stop menu items
	stopMenuItems:[
		{
			action  :'saveState',
			vmstates:['Running'],
			text    :_('Save the machine state'),
			icon    :"/virtualbox/images/vbox/fd_16px.png"
		},
		{
			action  :'powerButton',
			vmstates:['Running'],
			text    :_('ACPI Shutdown'),
			icon    :"/virtualbox/images/vbox/acpi_16px.png"
		},
		{
			action  :'pause',
			vmstates:['Running'],
			text    :_('Pause'),
			icon    :"/virtualbox/images/vbox/pause_16px.png"
		},
		{
			action  :'powerDown',
			vmstates:['Running', 'Paused', 'Stuck'],
			text    :_('Power off the machine'),
			icon    :"/virtualbox/images/vbox/poweroff_16px.png"
		},
		{
			action  :'reset',
			vmstates:['Running'],
			text    :_('Reset'),
			icon    :"/virtualbox/images/vbox/reset_16px.png"
		}
	],

	listeners:{

		show:function () {
			this.doLoad();
		}

	},

	initToolbar:function () {
		var panel = this;

		var tbar = OMV.Module.Services.vboxMachinesGridPanel.superclass.initToolbar.apply(this);

		tbar.insert(5, {
			id      :this.getId() + "-start",
			xtype   :"button",
			text    :_("Start"),
			icon    :"/virtualbox/images/vbox/start_16px.png",
			handler :function () {
				this.cbStateHdl({
					action:'powerUp',
					text  :_("Start")
				});
			},
			disabled:true,
			scope   :this

		});

		// Compose stop menu items
		menuItems = [];
		for (var i = 0; i < this.stopMenuItems.length; i++) {
			this.stopMenuItems[i].handler = function () { panel.cbStateHdl(this); };
			this.stopMenuItems[i].id = this.getId() + '-stop-' + this.stopMenuItems[i].action;
			menuItems[menuItems.length] = this.stopMenuItems[i];
		}
		tbar.insert(6, {
			id      :this.getId() + "-stop",
			xtype   :"button",
			text    :_("Stop"),
			icon    :"/virtualbox/images/vbox/state_powered_off_16px.png",
			disabled:true,
			menu    :menuItems,
			scope   :this
		});
		tbar.insert(8, { xtype:'tbseparator' });
		tbar.insert(9, {
			id      :this.getId() + "-edit",
			xtype   :"button",
			text    :_("Edit"),
			icon    :"images/edit.png",
			handler :this.cbEditBtnHdl.createDelegate(this),
			disabled:true,
			scope   :this
		});

		tbar.insert(10, { xtype:'tbseparator' });

		tbar.insert(20, {
			id     :this.getId() + "-phpvbx",
			xtype  :"button",
			text   :_("phpVirtualBox"),
			icon   :"/virtualbox/images/vbox/OSE/VirtualBox_16px.png",
			handler:function () {
				window.open("/virtualbox/");
			},
			scope  :this


		});

		return tbar;
	},

	/* Renderers */
	vmRenderer :function (val, cell, record, row, col, store) {
		return '<img src="/virtualbox/images/vbox/' + vboxGuestOSTypeIcon(record.data.OSTypeId) + '" style="width:15px;height:16px;valign:middle;float:left; margin-right: 4px;" /> ' + val;
	},

	stateRenderer:function (val) {
		return '<img src="/virtualbox/images/vbox/' + vboxMachineStateIcon(val) + '" style="width:15px;height:16px;valign:middle;float:left; margin-right: 4px;" /> ' + vboxVMState(val);
	},

	startModeRenderer:function (val) {
		if (val == 'auto') return 'Automatic';
		return 'Manual';
	},

	/* Button handlers */
	cbEditBtnHdl     :function () {
		var selModel = this.getSelectionModel();
		var record = selModel.getSelected();
		var wnd = new OMV.Module.Services.vboxVMEditDialog({
			uuid        :record.get("uuid"),
			sessionState:record.get("sessionState"),
			listeners   :{
				submit:function () {
					this.doReload();
				},
				scope :this
			}
		});
		wnd.show();
	},

	cbStateHdl:function (s) {

		var vm = this.getSelectionModel().getSelected().get("uuid");
		OMV.MessageBox.wait(null, s.text);
		// Execute RPC
		OMV.Ajax.request(this.cbVMStateHdl, this, "VirtualBox", 'setMachineState', { 'uuid':vm, 'state':s.action});

	},

	cbVMStateHdl:function (id, response, error) {

		if (error !== null) {
			OMV.MessageBox.hide();
			OMV.MessageBox.error(_("Progress error"), error);
			return;
		}

		if (!response.progress) {
			OMV.MessageBox.hide();
			return;
		}

		// Create task and progress indicator
		var runner = new Ext.util.TaskRunner();

		var store = this.store;
		var updateProgress = function (r) {

			var d = Ext.util.JSON.decode(r.responseText);

			if (!d || !d['progress'] || d['info']['completed'] || d['info']['canceled']) {
				store.reload();
				runner.stop(task);
				OMV.MessageBox.hide();
			} else {
				OMV.MessageBox.updateProgress(d['info']['percent'], d['info']['operationDescription']);
				return;
			}

			if (d.errors.length) {
				OMV.MessageBox.hide();
				OMV.MessageBox.error(null, {
					code   :-1,
					trace  :d.errors[0].details,
					message:d.errors[0].error
				});
			}
		};

		var task = {
			run     :function () {
				Ext.Ajax.request({
					url    :'/virtualbox/lib/ajax.php',
					success:updateProgress,
					params :{
						fn      :'progressGet',
						progress:response.progress
					}
				});
			},
			interval:3000 //3 seconds
		};
		runner.start(task);

	},

	cbPrivilegesBtnHdl:function () {
		var selModel = this.getSelectionModel();
		var record = selModel.getSelected();
		var wnd = new OMV.Module.Services.vboxPrivilegesPropertyDialog({
			uuid     :record.get("uuid"),
			listeners:{
				submit:function () {
					this.doReload();
				},
				scope :this
			}
		});
		wnd.show();
	},

	cbSelectionChangeHdl:function (model) {
		OMV.Module.Services.vboxMachinesGridPanel.superclass.cbSelectionChangeHdl.apply(this, arguments);
		// Process additional buttons
		var records = model.getSelections();
		var startBtn = this.getTopToolbar().findById(this.getId() + "-start");
		var stopBtn = this.getTopToolbar().findById(this.getId() + "-stop");
		var editBtn = this.getTopToolbar().findById(this.getId() + "-edit");
		if (records.length != 1) {
			startBtn.disable();
			stopBtn.disable();
			editBtn.disable();
		} else {
			if (['PoweredOff', 'Paused', 'Saved', 'Aborted', 'Teleported'].indexOf(records[0].data.state) > -1) {
				startBtn.enable();
			} else {
				startBtn.disable();
			}
			if (['Running', 'Paused', 'Stuck'].indexOf(records[0].data.state) > -1) {
				stopBtn.enable();
			} else {
				stopBtn.disable();
			}
			editBtn.enable();
			var m = stopBtn.menu.items;
			for (var i = 0; i < m.items.length; i++) {
				if (this.stopMenuItems[i].vmstates.indexOf(records[0].data.state) > -1) {
					m.items[i].enable();
				} else {
					m.items[i].disable();
				}
			}
		}
	}

});

OMV.NavigationPanelMgr.registerPanel("services", "virtualbox", {
	cls     :OMV.Module.Services.vboxSettingsPanel,
	position:10,
	title   :_("Settings")
});

OMV.NavigationPanelMgr.registerPanel("services", "virtualbox", {
	cls     :OMV.Module.Services.vboxMachinesGridPanel,
	position:20,
	title   :_("Virtual Machines")
});

OMV.Module.Services.vboxVMEditDialog = function (config) {
	var initialConfig = {
		rpcService  :"virtualbox",
		rpcGetMethod:"getMachine",
		rpcSetMethod:"setMachine",
		title       :_("Edit Virtual Machine"),
		autoHeight  :true
	};
	Ext.apply(initialConfig, config);
	OMV.Module.Services.vboxVMEditDialog.superclass.constructor.call(this, initialConfig);
};

Ext.extend(OMV.Module.Services.vboxVMEditDialog, OMV.CfgObjectDialog, {
	initComponent:function () {
		OMV.Module.Services.vboxVMEditDialog.superclass.initComponent.apply(this, arguments);
		this.on("load", this._updateFormFields, this);
	},

	getFormConfig:function () {
		return {
			autoHeight:true
		};
	},
	getFormItems :function () {
		return [
			{
				xtype     :"textfield",
				name      :"name",
				fieldLabel:"Name",
				allowBlank:false
			},
			{
				xtype        :"combo",
				name         :"startupMode",
				fieldLabel   :_("Startup Mode"),
				mode         :"local",
				store        :new Ext.data.SimpleStore({
					fields:[ "value", "text" ],
					data  :[
						[ "manual", _("Manual") ],
						[ "auto", _("Automatic") ]
					]
				}),
				displayField :"text",
				valueField   :"value",
				allowBlank   :false,
				editable     :false,
				triggerAction:"all",
				value        :"manual"
			}
		];
	},

	/**
	 * Private function to update the states of various form fields.
	 */
	_updateFormFields:function () {
		if (this.sessionState != "Unlocked")
			this.findFormField("name").setReadOnly(true);
	}
});

//Helpers
/**
 * VM State conversions
 * @param {String} state - virtual machine state
 * @return {String} string used for translation
 */
function vboxVMState(state) {
	switch (state) {
		case 'PoweredOff':
			return _('Powered Off');
		case 'LiveSnapshotting':
			return _('Live Snapshotting');
		case 'TeleportingPausedVM':
			return _('Teleporting Paused VM');
		case 'TeleportingIn':
			return _('Teleporting In');
		case 'TakingLiveSnapshot':
			return _('Taking Live Snapshot');
		case 'RestoringSnapshot':
			return _('Restoring Snapshot');
		case 'DeletingSnapshot':
			return _('Deleting Snapshot');
		case 'SettingUp':
			return _('Setting Up');
		default:
			return state;
	}
}

/**
 * Return the correct icon relative to images/vbox/ for the VM state.
 * @param {String} state - virtual machine state
 * @return {String} icon file name
 */
function vboxMachineStateIcon(state) {

	var strIcon = "state_powered_off_16px.png";
	var strNoIcon = "state_running_16px.png";

	switch (state) {
		case "PoweredOff":
			strIcon = "state_powered_off_16px.png";
			break;
		case "Saved":
			strIcon = "state_saved_16px.png";
			break;
		case "Teleported":
			strIcon = strNoIcon;
			break;
		case "LiveSnapshotting":
			strIcon = "online_snapshot_16px.png";
			break;
		case "Aborted":
			strIcon = "state_aborted_16px.png";
			break;
		case "Running":
			strIcon = "state_running_16px.png";
			break;
		case "Paused":
			strIcon = "state_paused_16px.png";
			break;
		case "Stuck":
			strIcon = "state_stuck_16px.png";
			break;
		case "Teleporting":
			strIcon = strNoIcon;
			break;
		case "Starting":
			strIcon = strNoIcon;
			break;
		case "Stopping":
			strIcon = strNoIcon;
			break;
		case "Saving":
			strIcon = "state_discarding_16px.png";
			break;
		case "Restoring":
			strIcon = "settings_16px.png";
			break;
		case "TeleportingPausedVM":
			strIcon = strNoIcon;
			break;
		case "TeleportingIn":
			strIcon = strNoIcon;
			break;
		case "RestoringSnapshot":
			strIcon = "discard_cur_state_16px.png";
			break;
		case "DeletingSnapshot":
			strIcon = "state_discarding_16px.png";
			break;
		case "SettingUp":
			strIcon = strNoIcon;
			break;
		case "Hosting" :
			strIcon = "settings_16px.png";
			break;
		case "Inaccessible":
			strIcon = "state_aborted_16px.png";
			break;
		default:
			break;
	}

	return strIcon;

}

/**
 * Return the correct icon string relative to images/vbox/ for the guest OS type
 * @param {String} osTypeId - guest OS type id
 * @return {String} icon file name
 */
function vboxGuestOSTypeIcon(osTypeId) {

	var strIcon = "os_other.png";
	switch (osTypeId) {
		case "Other":
			strIcon = "os_other.png";
			break;
		case "DOS":
			strIcon = "os_dos.png";
			break;
		case "Netware":
			strIcon = "os_netware.png";
			break;
		case "L4":
			strIcon = "os_l4.png";
			break;
		case "Windows31":
			strIcon = "os_win31.png";
			break;
		case "Windows95":
			strIcon = "os_win95.png";
			break;
		case "Windows98":
			strIcon = "os_win98.png";
			break;
		case "WindowsMe":
			strIcon = "os_winme.png";
			break;
		case "WindowsNT4":
			strIcon = "os_winnt4.png";
			break;
		case "Windows2000":
			strIcon = "os_win2k.png";
			break;
		case "WindowsXP":
			strIcon = "os_winxp.png";
			break;
		case "WindowsXP_64":
			strIcon = "os_winxp_64.png";
			break;
		case "Windows2003":
			strIcon = "os_win2k3.png";
			break;
		case "Windows2003_64":
			strIcon = "os_win2k3_64.png";
			break;
		case "WindowsVista":
			strIcon = "os_winvista.png";
			break;
		case "WindowsVista_64":
			strIcon = "os_winvista_64.png";
			break;
		case "Windows2008":
			strIcon = "os_win2k8.png";
			break;
		case "Windows2008_64":
			strIcon = "os_win2k8_64.png";
			break;
		case "Windows7":
			strIcon = "os_win7.png";
			break;
		case "Windows7_64":
			strIcon = "os_win7_64.png";
			break;
		case "WindowsNT":
			strIcon = "os_win_other.png";
			break;
		case "OS2Warp3":
			strIcon = "os_os2warp3.png";
			break;
		case "OS2Warp4":
			strIcon = "os_os2warp4.png";
			break;
		case "OS2Warp45":
			strIcon = "os_os2warp45.png";
			break;
		case "OS2eCS":
			strIcon = "os_os2ecs.png";
			break;
		case "OS2":
			strIcon = "os_os2_other.png";
			break;
		case "Linux22":
			strIcon = "os_linux22.png";
			break;
		case "Linux24":
			strIcon = "os_linux24.png";
			break;
		case "Linux24_64":
			strIcon = "os_linux24_64.png";
			break;
		case "Linux26":
			strIcon = "os_linux26.png";
			break;
		case "Linux26_64":
			strIcon = "os_linux26_64.png";
			break;
		case "ArchLinux":
			strIcon = "os_archlinux.png";
			break;
		case "ArchLinux_64":
			strIcon = "os_archlinux_64.png";
			break;
		case "Debian":
			strIcon = "os_debian.png";
			break;
		case "Debian_64":
			strIcon = "os_debian_64.png";
			break;
		case "OpenSUSE":
			strIcon = "os_opensuse.png";
			break;
		case "OpenSUSE_64":
			strIcon = "os_opensuse_64.png";
			break;
		case "Fedora":
			strIcon = "os_fedora.png";
			break;
		case "Fedora_64":
			strIcon = "os_fedora_64.png";
			break;
		case "Gentoo":
			strIcon = "os_gentoo.png";
			break;
		case "Gentoo_64":
			strIcon = "os_gentoo_64.png";
			break;
		case "Mandriva":
			strIcon = "os_mandriva.png";
			break;
		case "Mandriva_64":
			strIcon = "os_mandriva_64.png";
			break;
		case "RedHat":
			strIcon = "os_redhat.png";
			break;
		case "RedHat_64":
			strIcon = "os_redhat_64.png";
			break;
		case "Turbolinux":
			strIcon = "os_turbolinux.png";
			break;
		case "Ubuntu":
			strIcon = "os_ubuntu.png";
			break;
		case "Ubuntu_64":
			strIcon = "os_ubuntu_64.png";
			break;
		case "Xandros":
			strIcon = "os_xandros.png";
			break;
		case "Xandros_64":
			strIcon = "os_xandros_64.png";
			break;
		case "Linux":
			strIcon = "os_linux_other.png";
			break;
		case "FreeBSD":
			strIcon = "os_freebsd.png";
			break;
		case "FreeBSD_64":
			strIcon = "os_freebsd_64.png";
			break;
		case "OpenBSD":
			strIcon = "os_openbsd.png";
			break;
		case "OpenBSD_64":
			strIcon = "os_openbsd_64.png";
			break;
		case "NetBSD":
			strIcon = "os_netbsd.png";
			break;
		case "NetBSD_64":
			strIcon = "os_netbsd_64.png";
			break;
		case "Solaris":
			strIcon = "os_solaris.png";
			break;
		case "Solaris_64":
			strIcon = "os_solaris_64.png";
			break;
		case "OpenSolaris":
			strIcon = "os_oraclesolaris.png";
			break;
		case "OpenSolaris_64":
			strIcon = "os_oraclesolaris_64.png";
			break;
		case "QNX":
			strIcon = "os_qnx.png";
			break;
		case 'MacOS':
			strIcon = "os_macosx.png";
			break;
		case 'MacOS_64':
			strIcon = "os_macosx_64.png";
			break;
		case 'Oracle':
			strIcon = "os_oracle.png";
			break;
		case 'Oracle_64':
			strIcon = "os_oracle_64.png";
			break;
		case 'JRockitVE':
			strIcon = 'os_jrockitve.png';
			break;
		case "VirtualBox_Host":
			strIcon = "os_virtualbox.png";
			break;

		default:
			break;
	}
	return strIcon;
}

