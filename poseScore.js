// poseScore.js
// 上半身(肩・肘・手首)だけで姿勢を比較してスコア化するモジュール。
// 下半身(腰より下)は一切使わないので、腰や足が映らなくても動作します。
//
// 使う入力: MediaPipe の worldLandmarks(メートル単位・腰中心原点、y は下向き)

export const MIN_VISIBILITY = 0.5;

// 特徴ごとの重み。0 にするとその特徴は登録もスコア計算もされません。
export const DEFAULT_WEIGHTS = {
  leftWrist: 1.0,
  rightWrist: 1.0, // 肩に対する手首の位置(いちばん情報量が多い)
  leftElbow: 0.8,
  rightElbow: 0.8, // 肘の曲がり角度
  leftElbowPos: 0.6,
  rightElbowPos: 0.6, // 肩に対する肘の位置
};

const SIDES = {
  left: { shoulder: 11, elbow: 13, wrist: 15 },
  right: { shoulder: 12, elbow: 14, wrist: 16 },
};

// ---------- 特徴量の抽出 ----------

function angle3D(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const n = Math.hypot(v1.x, v1.y, v1.z) * Math.hypot(v2.x, v2.y, v2.z);
  if (n === 0) return null;
  return (Math.acos(Math.min(1, Math.max(-1, dot / n))) * 180) / Math.PI;
}

/**
 * worldLandmarks(33点の配列)から特徴量を作る。
 * 位置は「同じ側の肩を原点、肩幅を1」とした相対値なので、体格やカメラ距離に左右されにくい。
 */
export function extractFeatures(world, imageLandmarks = null) {
  if (!world || world.length < 17) return null;

  const ls = world[11];
  const rs = world[12];
  const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y, ls.z - rs.z);
  if (shoulderWidth < 0.05) return null; // 肩幅が極端に小さい = 検出が異常

  // 見えているかどうかは、画像ランドマーク(result.landmarks[0])の visibility を優先して使う
  const visOf = (i) => imageLandmarks?.[i]?.visibility ?? world[i].visibility ?? 1;
  const vis = (...ids) => Math.min(...ids.map(visOf));
  const rel = (p, s) => [(p.x - s.x) / shoulderWidth, (p.y - s.y) / shoulderWidth];

  const f = {};
  for (const [side, ids] of Object.entries(SIDES)) {
    const shoulder = world[ids.shoulder];
    const elbow = world[ids.elbow];
    const wrist = world[ids.wrist];

    f[`${side}Elbow`] = {
      type: "angle",
      value: angle3D(shoulder, elbow, wrist),
      vis: vis(ids.shoulder, ids.elbow, ids.wrist),
    };
    f[`${side}Wrist`] = {
      type: "pos",
      value: rel(wrist, shoulder),
      vis: vis(ids.shoulder, ids.wrist),
    };
    f[`${side}ElbowPos`] = {
      type: "pos",
      value: rel(elbow, shoulder),
      vis: vis(ids.shoulder, ids.elbow),
    };
  }
  return f;
}

// ---------- 手本の登録 ----------

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const std = (a, m) => Math.sqrt(mean(a.map((v) => (v - m) ** 2)));

/** 登録中に溜めた特徴量の配列(samples)から手本データを作る。 */
export class PoseRecorder {
  constructor() {
    this.samples = [];
    this.recording = false;
  }
  start() {
    this.samples = [];
    this.recording = true;
  }
  push(features) {
    if (this.recording && features) this.samples.push(features);
  }
  stop() {
    this.recording = false;
    return this.samples;
  }
}

export function buildReference(name, samples, weights = DEFAULT_WEIGHTS) {
  if (!samples || samples.length < 10) {
    throw new Error("サンプルが足りません。体が映った状態でもう一度登録してください。");
  }

  const features = {};
  const missing = []; // 十分に映っていなかった特徴
  const unstable = []; // 登録中にブレが大きかった特徴

  for (const [key, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;

    const items = samples
      .map((s) => s[key])
      .filter((f) => f && f.vis >= MIN_VISIBILITY && f.value != null);

    // 全フレームの6割以上で安定して見えていなければ除外
    if (items.length < samples.length * 0.6) {
      missing.push(key);
      continue;
    }

    const type = items[0].type;
    let value;
    let sd;
    if (type === "angle") {
      const vals = items.map((i) => i.value);
      value = mean(vals);
      sd = std(vals, value);
    } else {
      const xs = items.map((i) => i.value[0]);
      const ys = items.map((i) => i.value[1]);
      const mx = mean(xs);
      const my = mean(ys);
      value = [mx, my];
      sd = Math.hypot(std(xs, mx), std(ys, my));
    }

    const limit = type === "angle" ? 15 : 0.25;
    if (sd > limit) unstable.push(key);

    features[key] = { type, value, std: sd, weight };
  }

  return {
    name,
    version: 1,
    createdAt: new Date().toISOString(),
    features,
    missing,
    unstable,
  };
}

// ---------- スコア計算 ----------

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const DEFAULT_OPTS = {
  angleTol: 10, // この角度(°)以内の差なら満点
  angleMax: 50, // この角度以上の差なら0点
  posTol: 0.12, // この距離(肩幅=1)以内の差なら満点
  posMax: 0.7, // この距離以上の差なら0点
  minCoverage: 0.6, // 重みの6割以上の特徴が見えていないとスコアを出さない
};

/**
 * current: extractFeatures() の結果
 * ref: buildReference() の結果(または読み込んだJSON)
 * 戻り値: { valid, score(0-100), coverage, detail }
 */
export function scorePose(current, ref, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  if (!current || !ref) return { valid: false, score: 0, coverage: 0, detail: {} };

  let sum = 0;
  let wsum = 0;
  let totalW = 0;
  let usedW = 0;
  let worst = 1;
  const detail = {};

  for (const [key, r] of Object.entries(ref.features)) {
    totalW += r.weight;
    const c = current[key];
    if (!c || c.value == null || c.vis < MIN_VISIBILITY) continue;

    const isAngle = r.type === "angle";
    const err = isAngle
      ? Math.abs(c.value - r.value)
      : Math.hypot(c.value[0] - r.value[0], c.value[1] - r.value[1]);
    const base = isAngle ? o.angleTol : o.posTol;
    const max = isAngle ? o.angleMax : o.posMax;

    // 登録時にブレた特徴ほど許容を広げる
    const tol = Math.min(Math.max(base, r.std * 2), max * 0.8);
    const s = clamp01(1 - (err - tol) / (max - tol));

    const w = r.weight * c.vis;
    sum += s * w;
    wsum += w;
    usedW += r.weight;
    if (r.weight >= 0.7) worst = Math.min(worst, s); // 重要な特徴の最低点
    detail[key] = Math.round(s * 100);
  }

  const coverage = totalW > 0 ? usedW / totalW : 0;
  if (coverage < o.minCoverage || wsum === 0) {
    return { valid: false, score: 0, coverage, detail };
  }

  const avg = sum / wsum;
  return {
    valid: true,
    score: Math.round(100 * (0.7 * avg + 0.3 * worst)),
    coverage,
    detail,
  };
}

/** スコアのブレをならす(alphaが小さいほど滑らか) */
export class ScoreSmoother {
  constructor(alpha = 0.2) {
    this.alpha = alpha;
    this.value = null;
  }
  update(v) {
    this.value = this.value == null ? v : this.value * (1 - this.alpha) + v * this.alpha;
    return this.value;
  }
  reset() {
    this.value = null;
  }
}

// ---------- 保存・読み込み ----------

const STORAGE_PREFIX = "bearGame.pose.";

export function saveReference(ref) {
  try {
    localStorage.setItem(STORAGE_PREFIX + ref.name, JSON.stringify(ref));
  } catch (e) {
    console.warn("手本の保存に失敗しました", e);
  }
}

export function loadReference(name) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + name);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearReference(name) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + name);
  } catch (e) {
    /* 何もしない */
  }
}

/** GitHubなどに置いた poses/bear.json を読み込む場合 */
export async function loadReferenceFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`手本の読み込みに失敗しました: ${res.status}`);
  return res.json();
}

/** 手本をJSONファイルとしてダウンロード(リポジトリに置いて共有する用) */
export function downloadReference(ref) {
  const blob = new Blob([JSON.stringify(ref, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ref.name}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
