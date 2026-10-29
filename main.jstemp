// ========================================
// MediaPipe Pose Landmarker
// ========================================

import {
    PoseLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

import {
    extractFeatures,
    PoseRecorder,
    buildReference,
    scorePose,
    ScoreSmoother,
    saveReference,
    loadReference,
    clearReference,
    downloadReference
} from "./poseScore.js";


// ========================================
// 設定
// ========================================

// 手本の名前(保存するJSONのファイル名にもなる)
const REFERENCE_NAME = "bear";

// 手本を撮影する長さ(ミリ秒)
const RECORD_MS = 2000;

// true にすると、関節ごとの点数をスコアの横に表示する(調整用)
const SHOW_DETAIL = true;

const FEATURE_NAMES = {
    leftWrist: "左手首",
    rightWrist: "右手首",
    leftElbow: "左肘角度",
    rightElbow: "右肘角度",
    leftElbowPos: "左肘位置",
    rightElbowPos: "右肘位置"
};


// ========================================
// HTMLの部品
// ========================================

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const status = document.getElementById("status");
const scoreDisplay = document.getElementById("score");
const referenceInfo = document.getElementById("referenceInfo");
const startButton = document.getElementById("startButton");
const registerButton = document.getElementById("registerButton");
const exportButton = document.getElementById("exportButton");
const clearButton = document.getElementById("clearButton");


// ========================================
// 状態
// ========================================

let poseLandmarker = null;

// 最後に処理した動画時間
let lastVideoTime = -1;

// 手本(保存済みならページを開いたときに読み込む)
let reference = loadReference(REFERENCE_NAME);

// 手本の撮影用
const recorder = new PoseRecorder();

// 撮影中かどうか(撮影中は画面のメッセージを書き換えない)
let registering = false;

// スコアのブレをならす
const smoother = new ScoreSmoother(0.2);


// ========================================
// MediaPipeを準備
// ========================================

async function setupPose() {

    status.textContent = "AIを準備しています...";

    // MediaPipeのWASM実行環境
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
    );

    // Pose Landmarkerを作成
    poseLandmarker = await PoseLandmarker.createFromOptions(
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

    status.textContent = "AI準備完了！";
}


// ========================================
// カメラ開始
// ========================================

async function startCamera() {

    if (!window.isSecureContext) {
        throw new Error("HTTPSまたはlocalhostで実行してください");
    }

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        throw new Error("このブラウザではカメラを使用できません");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    status.textContent = "人を探しています...";

    // 姿勢検出開始
    detectPose();
}


// ========================================
// 姿勢検出
// ========================================

function detectPose() {

    if (!poseLandmarker || video.readyState < 2) {
        requestAnimationFrame(detectPose);
        return;
    }

    // 新しいフレームだけ処理
    if (video.currentTime !== lastVideoTime) {

        lastVideoTime = video.currentTime;

        try {

            const result = poseLandmarker.detectForVideo(
                video,
                performance.now()
            );

            if (result.landmarks && result.landmarks.length > 0) {
                handleResult(result);
            } else {
                handleNoPerson();
            }

        } catch (error) {
            console.error("姿勢検出エラー：", error);
        }
    }

    requestAnimationFrame(detectPose);
}


// 人体が見つかったとき
function handleResult(result) {

    const landmarks = result.landmarks[0];
    const world = result.worldLandmarks && result.worldLandmarks[0];

    drawPose(landmarks);

    // 上半身の特徴量(肩・肘・手首)を作る。下半身は使わない
    const features = extractFeatures(world, landmarks);

    // 撮影中だけサンプルが溜まる
    recorder.push(features);

    // 撮影中は画面のメッセージを書き換えない
    if (registering) {
        return;
    }

    updateScore(features);
}


// 人体が見つからないとき
function handleNoPerson() {

    clearCanvas();

    if (registering) {
        return;
    }

    status.textContent = "人が見つかりません";
    scoreDisplay.textContent = "姿勢スコア：--";
    smoother.reset();
}


// ========================================
// スコア表示
// ========================================

function updateScore(features) {

    if (!reference) {
        status.textContent = "手本を登録してください";
        scoreDisplay.textContent = "姿勢スコア：--";
        return;
    }

    const r = scorePose(features, reference);

    // 上半身が十分に映っていない
    if (!r.valid) {
        status.textContent = "肩から手までをカメラに映してください";
        scoreDisplay.textContent = "姿勢スコア：--";
        smoother.reset();
        return;
    }

    const score = Math.round(smoother.update(r.score));

    let text = "姿勢スコア：" + score;

    if (SHOW_DETAIL) {
        const detail = Object.entries(r.detail)
            .map(([key, s]) => (FEATURE_NAMES[key] || key) + " " + s)
            .join(" / ");

        text += "　[" + detail + "]";
    }

    scoreDisplay.textContent = text;

    if (score >= 80) {
        status.textContent = "🟢 GOOD！";
    } else if (score >= 50) {
        status.textContent = "🟡 もう少し！";
    } else {
        status.textContent = "🔴 姿勢を確認！";
    }

    // Unity連携用:スコアが出るたびにイベントを送る
    // 後で window.addEventListener("pose-score", ...) で受け取って
    // unityInstance.SendMessage(...) につなぐ
    window.dispatchEvent(
        new CustomEvent("pose-score", { detail: { score: score } })
    );
}


// ========================================
// 手本の登録
// ========================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function registerReference() {

    if (!poseLandmarker || registering) {
        return;
    }

    registering = true;
    registerButton.disabled = true;

    try {

        // カウントダウン(この間にポーズをとる)
        for (let i = 3; i > 0; i--) {
            status.textContent = "手本の姿勢をとってください… " + i;
            await sleep(1000);
        }

        // 撮影
        status.textContent = "撮影中…そのまま動かないでください";
        recorder.start();
        await sleep(RECORD_MS);
        const samples = recorder.stop();

        const ref = buildReference(REFERENCE_NAME, samples);

        // 使える特徴が少なすぎる = 上半身がうまく映っていない
        if (Object.keys(ref.features).length < 3) {
            throw new Error("肩から手までが映っていませんでした");
        }

        reference = ref;
        saveReference(reference);
        smoother.reset();

        // 映りが悪かった・ブレた部分があれば知らせる
        const names = (keys) =>
            keys.map((k) => FEATURE_NAMES[k] || k).join("、");

        let message = "手本を登録しました！";

        if (ref.missing.length > 0) {
            message += "(映っていない部分:" + names(ref.missing) + ")";
        }

        if (ref.unstable.length > 0) {
            message += "(ブレた部分:" + names(ref.unstable) + ")";
        }

        status.textContent = message;

    } catch (error) {

        console.error(error);
        status.textContent = "登録に失敗：" + error.message;

    } finally {

        recorder.stop();
        registering = false;
        registerButton.disabled = false;
        updateReferenceInfo();
    }
}


// 手本の表示とボタンの状態
function updateReferenceInfo() {

    if (reference) {
        const date = new Date(reference.createdAt)
            .toLocaleString("ja-JP");

        referenceInfo.textContent = "手本：登録済み（" + date + "）";
    } else {
        referenceInfo.textContent = "手本：未登録";
    }

    exportButton.disabled = !reference;
    clearButton.disabled = !reference;
}


// ========================================
// 骨格をCanvasに描画(上半身のみ)
// ========================================

function drawPose(landmarks) {

    clearCanvas();

    // 骨格をつなぐ線
    const connections = [
        [11, 12], // 肩
        [11, 13], // 左上腕
        [13, 15], // 左前腕
        [12, 14], // 右上腕
        [14, 16]  // 右前腕
    ];

    ctx.lineWidth = 4;
    ctx.strokeStyle = "lime";

    connections.forEach(([a, b]) => {

        const pointA = landmarks[a];
        const pointB = landmarks[b];

        if (pointA.visibility < 0.5 || pointB.visibility < 0.5) {
            return;
        }

        ctx.beginPath();
        ctx.moveTo(pointA.x * canvas.width, pointA.y * canvas.height);
        ctx.lineTo(pointB.x * canvas.width, pointB.y * canvas.height);
        ctx.stroke();
    });

    // 関節を描く(肩・肘・手首)
    [11, 12, 13, 14, 15, 16].forEach((i) => {

        const point = landmarks[i];

        if (point.visibility < 0.5) {
            return;
        }

        ctx.beginPath();
        ctx.arc(
            point.x * canvas.width,
            point.y * canvas.height,
            6,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = "red";
        ctx.fill();
    });
}


// ========================================
// Canvasを消す
// ========================================

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}


// ========================================
// ボタン
// ========================================

startButton.addEventListener("click", async () => {

    startButton.disabled = true;

    try {

        await setupPose();
        await startCamera();

        // カメラが動き出したら登録できる
        registerButton.disabled = false;

    } catch (error) {

        console.error(error);
        status.textContent = "起動に失敗しました";
        console.error("詳細：", error.message);
        startButton.disabled = false;
    }
});

registerButton.addEventListener("click", registerReference);

exportButton.addEventListener("click", () => {
    if (reference) {
        downloadReference(reference);
    }
});

clearButton.addEventListener("click", () => {
    clearReference(REFERENCE_NAME);
    reference = null;
    smoother.reset();
    scoreDisplay.textContent = "姿勢スコア：--";
    updateReferenceInfo();
});


// ページを開いたときの表示
updateReferenceInfo();
