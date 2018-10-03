//搜索蓝牙打印机函数
var SearchBluetooth = function() {
	/*dom变量定义*/
	var BluetoothBtn = document.getElementById("BluetoothBtn"), //最下边的按钮
		unpairedList = document.getElementById("unpairedList"), //未配对设备列表
		pairedList = document.getElementById("pairedList"), //已配对设备列表
		loadImgHtml = '<img src="images/ring.gif" class="loadImg"/>'; //加载图像HTML

	/*plus变量定义*/
	var main, BluetoothAdapter, BAdapter, IntentFilter, BluetoothDevice, receiver; //有些我也不知道是啥意思-_-!;

	/*其他定义*/
	var isSearchDevices = false, //是否处于搜索状态
		savedBleId = localStorage.getItem("bleId"), //缓存的设备ID
		IntervalObj, //定时器对象
		BleDeviceObjAry = [], //BleDevice对象数组 
		debug = true; //调试模式

	return {
		//初始化方法
		Init: function() {
			main = plus.android.runtimeMainActivity(),
				BluetoothAdapter = plus.android.importClass("android.bluetooth.BluetoothAdapter"),
				IntentFilter = plus.android.importClass('android.content.IntentFilter'),
				BluetoothDevice = plus.android.importClass("android.bluetooth.BluetoothDevice"),
				BAdapter = new BluetoothAdapter.getDefaultAdapter();

			this.CheckBluetoothState();
			this.EventInit();
		},

		//事件绑定
		EventInit: function() {
			var self = this,
				bdevice = new BluetoothDevice();

			//搜索
			BluetoothBtn.addEventListener("tap", function() {
				if(!isSearchDevices) {
					self.SearchDevices();
				}
			});

			/*未配对列表点击事件*/
			mui("#unpairedList").on("tap", "li", function() {
				var id = this.getAttribute("data-id"),
					state = true;
				self.SetButtonStatus("正在配对...", true);
				for(var i = 0, l = BleDeviceObjAry.length; i < l; i++) {
					var BleDeviceItem = BleDeviceObjAry[i];
					main.unregisterReceiver(receiver); //取消监听

					if(BleDeviceItem.getAddress() === id) {
						BleDeviceItem.createBond();

						self.SetButtonStatus("正在配对...", true);

						var testBondState = setInterval(function() {
							if(BleDeviceItem.getBondState() === bdevice.BOND_BONDED) {
								mui.toast("配对成功");
								self.SetButtonStatus("配对成功正在尝试连接打印机...", true);
								localStorage.setItem("bleId", id);
								
								var bleObj = new ConnectPrinter(id);
								bleObj = null;
								window.clearInterval(testBondState);
								mui.back();
							} else if(BleDeviceItem.getBondState() === bdevice.BOND_NONE) {
								mui.toast("配对失败");
								window.clearInterval(testBondState);
								self.SetButtonStatus("重新搜索设备", false);
							}
						}, 1000);
						state = false;
						break;
					}
				}

				if(state) {
					mui.toast("配对失败请重新搜索设备");
					self.SetButtonStatus("重新搜索设备", false);
				}
			});

			/*已配对列表点击事件*/
			mui("#pairedList").on("tap", "li", function() {
				var id = this.getAttribute("data-id");
				if(id) {
					self.SetButtonStatus("配对成功正在尝试连接打印机...", true);
					localStorage.setItem("bleId", id);
					var bleObj = new ConnectPrinter(id);
						bleObj = null;
					mui.back();
				}
			});
		},

		//检测蓝牙状态
		CheckBluetoothState: function() {
			var self = this;
			if(!BAdapter.isEnabled()) {
				plus.nativeUI.confirm("蓝牙处于关闭状态，是否打开？", function(e) {
					if(e.index == 0) {
						BAdapter.enable();
					}
				});
				debug && console.log("蓝牙处于关闭状态，正在打开...");
			} else {
				self.SearchDevices();
				debug && console.log("蓝牙处于开启状态，准备搜索蓝牙设备...");
			}
		},

		//搜索设备
		SearchDevices: function() {
			var self = this;
			isSearchDevices = true;
			self.SetButtonStatus("正在搜索蓝牙设备...", true);
			debug && console.log("开始搜索蓝牙设备...");

			var filter = new IntentFilter(),
				bdevice = new BluetoothDevice();

			BleDeviceObjAry = []; //清空BleDeviceObjAry
			unpairedList.innerHTML = '';
			pairedList.innerHTML = '';
			BAdapter.startDiscovery(); //开启搜索

			receiver = plus.android.implements('io.dcloud.android.content.BroadcastReceiver', {
				onReceive: onReceiveFn
			});
			filter.addAction(bdevice.ACTION_FOUND);
			filter.addAction(BAdapter.ACTION_DISCOVERY_STARTED);
			filter.addAction(BAdapter.ACTION_DISCOVERY_FINISHED);
			filter.addAction(BAdapter.ACTION_STATE_CHANGED);
			main.registerReceiver(receiver, filter); //注册监听事件

			//监听回调函数
			function onReceiveFn(context, intent) {
				plus.android.importClass(intent); //通过intent实例引入intent类，方便以后的‘.’操作

				//开始搜索改变状态
				intent.getAction() === "android.bluetooth.device.action.FOUND" && (isSearchDevices = true);

				//判断是否搜索结束
				if(intent.getAction() === 'android.bluetooth.adapter.action.DISCOVERY_FINISHED') {
					main.unregisterReceiver(receiver); //取消监听
					isSearchDevices = false;
					BleDeviceObjAry = [];
					self.SetButtonStatus("重新搜索设备", false);
					return false;
				}

				var BleDevice = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE),
					bleName = BleDevice.getName(), //设备名称
					bleId = BleDevice.getAddress(); //设备mac地址

				if(!bleName || !bleId) {
					return false;
				}

				//判断是否配对
				if(BleDevice.getBondState() === bdevice.BOND_BONDED) {
					debug && console.log("已配对蓝牙设备：" + bleName + '    ' + bleId);

					self.SetpairedListHtml(pairedList, bleName, bleId);
					//如果缓存保存的设备ID和该ID一致则配对
					if(savedBleId == bleId) {
						BleDevice.createBond();
					}

				} else {
					debug && console.log("未配对蓝牙设备：" + bleName + '    ' + bleId);

					BleDeviceObjAry.push(BleDevice);
					self.SetpairedListHtml(unpairedList, bleName, bleId);
				}

			}

		},

		//设置设备列表HTML
		SetpairedListHtml: function(parentEl, bleName, bleId) {
			var li = document.createElement('li');
			li.setAttribute("data-id", bleId);
			li.innerHTML = bleName + "<span>" + bleId + "</span>";
			parentEl.appendChild(li);
		},

		//更改按钮状态
		SetButtonStatus: function(tipText, isDisabled) {
			if(isDisabled) {
				BluetoothBtn.innerHTML = loadImgHtml + tipText;
				BluetoothBtn.classList.add("mui-disabled");
			} else {
				BluetoothBtn.innerHTML = tipText;
				BluetoothBtn.classList.remove("mui-disabled");
			}
		}
	}
}();
//连接打印机和打印
(function(window) {
	window.ConnectPrinter = function(bleId) {
		var plusMain = plus.android.runtimeMainActivity(),
			BluetoothAdapter = plus.android.importClass("android.bluetooth.BluetoothAdapter"),
			UUID = plus.android.importClass("java.util.UUID"),
			uuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"),
			BAdapter = BluetoothAdapter.getDefaultAdapter(),
			device = BAdapter.getRemoteDevice(bleId);

		plus.android.importClass(device);

		var bluetoothSocket = device.createInsecureRfcommSocketToServiceRecord(uuid);
		plus.android.importClass(bluetoothSocket);
		if(!bluetoothSocket.isConnected()) {
			bluetoothSocket.connect();
		}
		mui.toast('打印机已就绪，可正常打印！');

		this.gotoPrint = function(byteStr) {
			var outputStream = bluetoothSocket.getOutputStream();
			plus.android.importClass(outputStream);
			var bytes = plus.android.invoke(byteStr, 'getBytes', 'gbk');
			outputStream.write(bytes);
			outputStream.flush();
			device = null;
		};
	};
})(window);