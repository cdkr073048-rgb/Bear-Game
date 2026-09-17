// MediaPipeを読み込む
const {
    PoseLandmarker,
    FilesetResolver
} = await import(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs"
);


// HTMLの部品
const video =
    document.getElementById("video");

const status =
    document.getElementById("status");

const startButton =
    document.getElementById("startButton");


// Pose Landmarker
let poseLandmarker = null;


// 前回処理した動画時間
let lastVideoTime = -1;


// ==========================
// MediaPipeを準備
// ==========================

async function setupPose() {

    status.textContent =
        "AIを準備しています...";


    // MediaPipeの実行環境
    const vision =
        await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
        );


    // Pose Landmarkerを作成
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
        "AI準備完了！";
}


// ==========================
// カメラ開始
// ==========================

async function startCamera() {

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: "user",
                    width: 640,
                    height: 480
                },

                audio: false
            });


        video.srcObject = stream;

        await video.play();


        status.textContent =
            "人を探しています...";


        detectPose();


    } catch (error) {

        console.error(error);

        status.textContent =
            "カメラを起動できませんでした。";

    }
}


// ==========================
// 姿勢検出
// ==========================

function detectPose() {

    if (
        poseLandmarker &&
        video.readyState >= 2
    ) {

        if (
            video.currentTime !==
            lastVideoTime
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


                checkPosture(
                    landmarks
                );


            } else {

                status.textContent =
                    "人が見つかりません";

            }
        }
    }


    requestAnimationFrame(
        detectPose
    );
}


// ==========================
// 姿勢判定
// ==========================

function checkPosture(
    landmarks
) {

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
        (
            leftShoulder.y +
            rightShoulder.y
        ) / 2;


    // 腰の中心
    const hipY =
        (
            leftHip.y +
            rightHip.y
        ) / 2;


    // 肩と腰の距離
    const difference =
        hipY - shoulderY;


    // 仮の姿勢判定
    if (difference > 0.25) {

        status.textContent =
            "🟢 GOOD！";

    } else {

        status.textContent =
            "🔴 姿勢を確認！";
    }
}


// ==========================
// ボタン
// ==========================

startButton.addEventListener(
    "click",
    async () => {

        startButton.disabled =
            true;

        try {

            await setupPose();

            await startCamera();

        } catch (error) {

            console.error(error);

            status.textContent =
                "MediaPipeの起動に失敗しました。";

        }

    }
);
