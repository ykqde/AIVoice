(function () {
  let btnStatus = "UNDEFINED"; // "UNDEFINED" "CONNECTING" "OPEN" "CLOSING" "CLOSED"
  const btnControl = document.getElementById("btn_control");
  const recorder = new RecorderManager("./dist");
  recorder.onStart = () => {
    changeBtnStatus("OPEN");
  };

  let iatWS;
  let resultText = "";
  let resultTextTemp = "";
  let countdownInterval;

  // 直接使用 roleType 开启角色分离（roleType=2 开启角色分离）
  const roleType = 2; // 这里默认开启角色分离

  /**
   * 获取websocket url
   * 该接口需要后端提供，这里为了方便前端处理
   */
  function getWebSocketUrl() {
    var url = "wss://rtasr.xfyun.cn/v1/ws";
    var appId = APPID;
    var secretKey = API_KEY;
    var ts = Math.floor(new Date().getTime() / 1000);
    var signa = hex_md5(appId + ts);
    var signatureSha = CryptoJSNew.HmacSHA1(signa, secretKey);
    var signature = CryptoJS.enc.Base64.stringify(signatureSha);
    signature = encodeURIComponent(signature);
    return `${url}?appid=${appId}&ts=${ts}&signa=${signature}&roleType=${roleType}`;
  }

  function changeBtnStatus(status) {
    btnStatus = status;
    if (status === "CONNECTING") {
      btnControl.innerText = "建立连接中";
      document.getElementById("result").innerText = "";
      resultText = "";
      resultTextTemp = "";
    } else if (status === "OPEN") {
      btnControl.innerText = "录音中";
    } else if (status === "CLOSING") {
      btnControl.innerText = "关闭连接中";
    } else if (status === "CLOSED") {
      btnControl.innerText = "开始录音";
    }
  }

  // 渲染返回的结果并根据角色分离显示
  function renderResult(resultData) {
    let jsonData = JSON.parse(resultData);
  
    if (jsonData.action == "started") {
      console.log("握手成功");
    } else if (jsonData.action == "result") {
      const data = JSON.parse(jsonData.data);
      let resultTextTemp = "";
      let roleConversations = {
        1: "", // 角色 1
        2: "", // 角色 2
        // 其他角色
      };
  
      // 检查角色分离的具体结构
      data.cn.st.rt.forEach((j) => {
        j.ws.forEach((k) => {
          k.cw.forEach((l) => {
            let roleText = l.w;  // 识别的文本
            let speakerId = k.speaker;  // 角色 ID
  
            // 如果有角色信息，则根据角色分离显示不同的说话内容
            if (speakerId === 1) {
              roleConversations[1] += roleText; // 累积角色 1 的话
            } else if (speakerId === 2) {
              roleConversations[2] += roleText; // 累积角色 2 的话
            } else {
              // 其他角色处理
              roleConversations[speakerId] = (roleConversations[speakerId] || "") + roleText;
            }
          });
        });
      });
  
      // 渲染每个角色的对话
      Object.keys(roleConversations).forEach((roleId) => {
        let roleText = roleConversations[roleId];
        if (roleText.trim()) {
          // 根据角色 ID 渲染不同颜色的对话
          let speakerName = roleId === "1" ? "角色 1" : roleId === "2" ? "角色 2" : ``;
          resultTextTemp += `<span style="color: ${roleId === "1" ? 'blue' : 'green'};">${speakerName}: ${roleText}</span><br>`;
        }
      });
  
      // 最终识别结果
      if (data.cn.st.type == 0) {
        resultText += resultTextTemp;
        resultTextTemp = "";
      }
  
      // 更新页面显示
      document.getElementById("result").innerHTML = resultText + resultTextTemp;
    } else if (jsonData.action == "error") {
      console.log("出错了:", jsonData);
    }
  }
  
  

  // 连接 WebSocket
  function connectWebSocket() {
    // 角色分离开启后，可以执行连接操作（直接开启）
    const websocketUrl = getWebSocketUrl();
    if ("WebSocket" in window) {
      iatWS = new WebSocket(websocketUrl);
    } else if ("MozWebSocket" in window) {
      iatWS = new MozWebSocket(websocketUrl);
    } else {
      alert("浏览器不支持WebSocket");
      return;
    }
    changeBtnStatus("CONNECTING");
    iatWS.onopen = (e) => {
      recorder.start({
        sampleRate: 16000,
        frameSize: 1280,
      });
    };
    iatWS.onmessage = (e) => {
      renderResult(e.data);
    };
    iatWS.onerror = (e) => {
      console.error(e);
      recorder.stop();
      changeBtnStatus("CLOSED");
    };
    iatWS.onclose = (e) => {
      recorder.stop();
      changeBtnStatus("CLOSED");
    };
  }

  recorder.onFrameRecorded = ({ isLastFrame, frameBuffer }) => {
    if (iatWS.readyState === iatWS.OPEN) {
      iatWS.send(new Int8Array(frameBuffer));
      if (isLastFrame) {
        iatWS.send('{"end": true}');
        changeBtnStatus("CLOSING");
      }
    }
  };

  recorder.onStop = () => {
    clearInterval(countdownInterval);
  };

  // 点击按钮控制录音开始与停止
  btnControl.onclick = function () {
    if (btnStatus === "UNDEFINED" || btnStatus === "CLOSED") {
      connectWebSocket();
    } else if (btnStatus === "CONNECTING" || btnStatus === "OPEN") {
      // 无论角色分离是否开启，都可以停止录音
      recorder.stop();
    }
  };
})();
