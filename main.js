const video =
    document.getElementById("video");

const canvas =
    document.getElementById("canvas");

const ctx =
    canvas.getContext("2d");

const message =
    document.getElementById("message");

const startButton =
    document.getElementById("startButton");

const resultText =
    document.getElementById("result");

const scoreText =
    document.getElementById("score");


let poseLandmarker = null;
let lastVideoTime = -1;


// ================================
// MediaPipeを準備
// ================================

async function setupPose() {

    message.textContent =
        "姿勢AIを読み込んでいます...";


    const vision =
        await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
        );


    poseLandmarker =
        await PoseLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {

                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
                },

                runningMode: "VIDEO",

                numPoses: 1
            }
        );


    message.textContent =
        "姿勢AIの準備完了！";
}


// ================================
// カメラを開始
// ================================

async function startCamera() {

    const stream =
        await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });


    video.srcObject = stream;

    await video.play();


    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;


    message.textContent =
        "姿勢を検出しています...";


    detectPose();
}


// ================================
// 姿勢検出
// ================================

function detectPose() {

    if (
        poseLandmarker &&
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime
    ) {

        const result =
            poseLandmarker.detectForVideo(
                video,
                performance.now()
            );


        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        if (
            result.landmarks &&
            result.landmarks.length > 0
        ) {

            const landmarks =
                result.landmarks[0];


            // 骨格を描画
            const drawingUtils =
                new DrawingUtils(ctx);


            drawingUtils.drawConnectors(
                landmarks,
                PoseLandmarker.POSE_CONNECTIONS
            );


            drawingUtils.drawLandmarks(
                landmarks
            );


            resultText.textContent =
                "人を検出しました";

            scoreText.textContent =
                "姿勢スコア：100";


        } else {

            resultText.textContent =
                "人を検出できません";

            scoreText.textContent =
                "姿勢スコア：--";
        }


        lastVideoTime =
            video.currentTime;
    }


    requestAnimationFrame(
        detectPose
    );
}


// ================================
// スタートボタン
// ================================

startButton.addEventListener(
    "click",
    async () => {

        startButton.disabled = true;

        try {

            await setupPose();

            await startCamera();

        } catch (error) {

            console.error(error);

            message.textContent =
                "姿勢AIの起動に失敗しました";

            resultText.textContent =
                error.name;

            scoreText.textContent =
                error.message;

            startButton.disabled = false;
        }
    }
);
