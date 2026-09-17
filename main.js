// ========================================
// MediaPipe Pose Landmarker
// ========================================

import {
    PoseLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";


// ========================================
// HTMLの部品
// ========================================

const video =
    document.getElementById("video");

const canvas =
    document.getElementById("canvas");

const ctx =
    canvas.getContext("2d");

const status =
    document.getElementById("status");

const scoreDisplay =
    document.getElementById("score");

const startButton =
    document.getElementById("startButton");


// ========================================
// MediaPipe
// ========================================

let poseLandmarker = null;


// 最後に処理した動画時間
let lastVideoTime = -1;


// ========================================
// MediaPipeを準備
// ========================================

async function setupPose() {

    status.textContent =
        "AIを準備しています...";


    // MediaPipeのWASM実行環境
    const vision =
        await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );


    // Pose Landmarkerを作成
    poseLandmarker =
        await PoseLandmarker.createFromOptions(
            vision,
            {

                baseOptions: {

                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

                    // スマホでもまずはCPUで動かす
                    delegate: "CPU"
                },

                runningMode: "VIDEO",

                numPoses: 1,

                minPoseDetectionConfidence: 0.5,

                minPosePresenceConfidence: 0.5,

                minTrackingConfidence: 0.5
            }
        );


    status.textContent =
        "AI準備完了！";
}


// ========================================
// カメラ開始
// ========================================

async function startCamera() {

    if (!window.isSecureContext) {

        throw new Error(
            "HTTPSまたはlocalhostで実行してください"
        );
    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        throw new Error(
            "このブラウザではカメラを使用できません"
        );
    }


    const stream =
        await navigator.mediaDevices.getUserMedia({

            video: {

                facingMode: "user",

                width: {
                    ideal: 640
                },

                height: {
                    ideal: 480
                }
            },

            audio: false
        });


    video.srcObject = stream;


    // カメラの読み込みが完了するまで待つ
    await new Promise((resolve) => {

        video.onloadeddata = resolve;

    });


    await video.play();


    // Canvasのサイズをカメラと同じにする
    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;


    status.textContent =
        "人を探しています...";


    // 姿勢検出開始
    detectPose();
}


// ========================================
// 姿勢検出
// ========================================

function detectPose() {

    if (
        !poseLandmarker ||
        video.readyState < 2
    ) {

        requestAnimationFrame(
            detectPose
        );

        return;
    }


    // 新しいフレームだけ処理
    if (
        video.currentTime !==
        lastVideoTime
    ) {

        lastVideoTime =
            video.currentTime;


        try {

            const result =
                poseLandmarker.detectForVideo(
                    video,
                    performance.now()
                );


            // 人体が見つかった
            if (
                result.landmarks &&
                result.landmarks.length > 0
            ) {

                const landmarks =
                    result.landmarks[0];


                drawPose(landmarks);


                checkPosture(landmarks);

            }

            // 人体が見つからない
            else {

                clearCanvas();

                status.textContent =
                    "人が見つかりません";

                scoreDisplay.textContent =
                    "姿勢スコア：--";
            }

        }

        catch (error) {

            console.error(
                "姿勢検出エラー：",
                error
            );
        }
    }


    requestAnimationFrame(
        detectPose
    );
}


// ========================================
// 骨格をCanvasに描画
// ========================================

function drawPose(landmarks) {

    clearCanvas();


    // 骨格をつなぐ線
    const connections = [

        [11, 12], // 肩

        [11, 13], // 左上腕
        [13, 15], // 左前腕

        [12, 14], // 右上腕
        [14, 16], // 右前腕

        [11, 23], // 左側
        [12, 24], // 右側

        [23, 24], // 腰

        [23, 25], // 左太もも
        [25, 27], // 左すね

        [24, 26], // 右太もも
        [26, 28]  // 右すね
    ];


    // 線を描く
    ctx.lineWidth = 4;


    connections.forEach(
        ([a, b]) => {

            const pointA =
                landmarks[a];

            const pointB =
                landmarks[b];


            if (
                pointA.visibility < 0.5 ||
                pointB.visibility < 0.5
            ) {
                return;
            }


            ctx.beginPath();

            ctx.moveTo(
                pointA.x * canvas.width,
                pointA.y * canvas.height
            );

            ctx.lineTo(
                pointB.x * canvas.width,
                pointB.y * canvas.height
            );

            ctx.strokeStyle = "lime";

            ctx.stroke();
        }
    );


    // 関節を描く
    landmarks.forEach(
        (point) => {

            if (
                point.visibility < 0.5
            ) {
                return;
            }


            const x =
                point.x * canvas.width;

            const y =
                point.y * canvas.height;


            ctx.beginPath();

            ctx.arc(
                x,
                y,
                6,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = "red";

            ctx.fill();
        }
    );
}


// ========================================
// Canvasを消す
// ========================================

function clearCanvas() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}


// ========================================
// 姿勢判定
// ========================================

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


    // 4点の信頼度が低い場合
    if (
        leftShoulder.visibility < 0.5 ||
        rightShoulder.visibility < 0.5 ||
        leftHip.visibility < 0.5 ||
        rightHip.visibility < 0.5
    ) {

        status.textContent =
            "体全体をカメラに映してください";

        scoreDisplay.textContent =
            "姿勢スコア：--";

        return;
    }


    // 肩の中心
    const shoulderX =
        (
            leftShoulder.x +
            rightShoulder.x
        ) / 2;

    const shoulderY =
        (
            leftShoulder.y +
            rightShoulder.y
        ) / 2;


    // 腰の中心
    const hipX =
        (
            leftHip.x +
            rightHip.x
        ) / 2;

    const hipY =
        (
            leftHip.y +
            rightHip.y
        ) / 2;


    // 肩→腰の差
    const dx =
        hipX - shoulderX;

    const dy =
        hipY - shoulderY;


    // 縦方向に対してどれくらい傾いているか
    const angle =
        Math.abs(
            Math.atan2(dx, dy)
            * 180 /
            Math.PI
        );


    // 角度を100点満点にする
    const score =
        Math.max(
            0,
            100 - angle * 3
        );


    scoreDisplay.textContent =
        "姿勢スコア：" +
        Math.round(score);


    // 仮の判定
    if (angle < 15) {

        status.textContent =
            "🟢 GOOD！";

    }

    else {

        status.textContent =
            "🔴 姿勢を確認！";
    }
}


// ========================================
// カメラ開始ボタン
// ========================================

startButton.addEventListener(
    "click",
    async () => {

        startButton.disabled = true;

        try {

            await setupPose();

            await startCamera();

        }

        catch (error) {

            console.error(error);

            status.textContent =
                "起動に失敗しました";

            console.error(
                "詳細：",
                error.message
            );

            startButton.disabled = false;
        }
    }
);
