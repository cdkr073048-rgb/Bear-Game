const video = document.getElementById("video");
const status = document.getElementById("status");
const startButton = document.getElementById("startButton");

let poseLandmarker = null;
let lastVideoTime = -1;


// =========================
// MediaPipeを準備
// =========================

async function setupPose() {

    status.textContent = "AIを準備しています...";

    const vision =
        await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
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

    status.textContent =
        "AIの準備完了！カメラを開始してください。";
}


// =========================
// カメラ開始
// =========================

async function startCamera() {

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user"
                },
                audio: false
            });

        video.srcObject = stream;

        video.addEventListener(
            "loadeddata",
            () => {

                status.textContent =
                    "人を探しています...";

                detectPose();

            },
            { once: true }
        );

    } catch (error) {

        console.error(error);

        status.textContent =
            "カメラを使用できませんでした。";

    }
}


// =========================
// 姿勢検出
// =========================

async function detectPose() {

    if (
        video.currentTime !== lastVideoTime
        &&
        poseLandmarker
    ) {

        lastVideoTime =
            video.currentTime;

        const result =
            poseLandmarker.detectForVideo(
                video,
                performance.now()
            );

        if (
            result.landmarks &&
            result.landmarks.length > 0
        ) {

            const landmarks =
                result.landmarks[0];

            checkPosture(landmarks);

        } else {

            status.textContent =
                "人が見つかりません";
        }
    }

    requestAnimationFrame(detectPose);
}


// =========================
// 姿勢判定
// =========================

function checkPosture(landmarks) {

    // 左肩
    const leftShoulder =
        landmarks[11];

    // 右肩
    const rightShoulder =
        landmarks[12];

    // 左腰
    const leftHip =
        landmarks[23];

    // 右腰
    const rightHip =
        landmarks[24];


    // 肩の中心
    const shoulderY =
        (leftShoulder.y +
         rightShoulder.y) / 2;


    // 腰の中心
    const hipY =
        (leftHip.y +
         rightHip.y) / 2;


    // 肩と腰の距離
    const difference =
        hipY - shoulderY;


    // 仮の判定
    if (difference > 0.25) {

        status.textContent =
            "🟢 GOOD！";

    } else {

        status.textContent =
            "🔴 姿勢を確認！";
    }
}


// =========================
// ボタン
// =========================

startButton.addEventListener(
    "click",
    async () => {

        startButton.disabled = true;

        await setupPose();

        await startCamera();

    }
);
