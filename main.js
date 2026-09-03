const video =
    document.getElementById("video");

const message =
    document.getElementById("message");

const startButton =
    document.getElementById("startButton");


startButton.addEventListener("click", async () => {

    try {

        message.textContent =
            "カメラを起動しています...";


        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });


        video.srcObject = stream;


        message.textContent =
            "カメラ起動成功！";


    } catch (error) {

        console.error(error);


        message.textContent =
            "カメラ起動失敗：" +
            error.name;
    }

});
