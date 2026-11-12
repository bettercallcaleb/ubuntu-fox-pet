#!/usr/bin/env python3
"""Refit Fox_Realistic_Rigged.glb: straighten the mesh, re-place joints, re-skin.

Why: the shipped asset was sculpted mid-stride and slightly banana-shaped
(tail/hips drifted to +x, head to -x) while the 29-bone skeleton lies on the
x=0 midline and the front-leg bones sit ~0.15 behind the real legs. Any bone
rotation therefore swung geometry around the wrong pivot (stiff, broken poses).

This script (numpy only):
  1. unbends the mesh along its own centerline so the body axis is straight,
  2. moves every joint to an anatomical position measured on that mesh and
     recomputes node translations + inverse bind matrices (rotations, bone
     names, hierarchy and animations are untouched),
  3. recomputes JOINTS_0 / WEIGHTS_0 from distance-to-bone-segment with
     side and height rules (leg bones never pull the back / opposite side).

usage: refit_realistic_fox.py ORIGINAL.glb OUTPUT.glb
"""
import json, struct, sys
import numpy as np

CT = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}

# ---- target skeleton, world bind positions on the unbent mesh -------------
# (x lateral, +x = animal left; y up; z forward)
JOINT = {
    "motion_root": (0, 0, 0),
    "hips": (0, .355, -.095), "spine0": (0, .36, -.02), "spine1": (0, .365, .07),
    "chest": (0, .365, .17), "neck": (0, .40, .225), "head": (0, .455, .265),
    "earL": (-.005, .565, .385), "earR": (-.062, .575, .355),
    "tail0": (0, .385, -.14), "tail1": (0, .29, -.20), "tail2": (0, .20, -.27), "tail3": (0, .11, -.34),
    "thighL0": (.045, .335, .29), "shinL0": (.045, .22, .285), "footL0": (.045, .07, .275), "toeL0": (.047, .025, .30),
    "thighR0": (-.035, .335, .255), "shinR0": (-.035, .22, .245), "footR0": (-.034, .07, .228), "toeR0": (-.037, .025, .255),
    "thighL1": (.05, .33, -.06), "shinL1": (.045, .21, -.065), "footL1": (.043, .10, -.075), "toeL1": (.05, .03, -.04),
    "thighR1": (-.05, .33, -.10), "shinR1": (-.043, .21, -.107), "footR1": (-.037, .10, -.115), "toeR1": (-.055, .03, -.095),
}
TIP = {  # virtual end points used only for skinning segments
    "head": (0, .43, .455), "earL": (-.003, .612, .39), "earR": (-.07, .657, .35), "tail3": (0, .02, -.42),
    "toeL0": (.05, 0, .345), "toeR0": (-.04, 0, .295), "toeL1": (.05, 0, .01), "toeR1": (-.058, 0, -.052),
}
CHAIN = {  # bone -> child that ends its skinning segment
    "hips": "spine0", "spine0": "spine1", "spine1": "chest", "chest": "neck", "neck": "head",
    "tail0": "tail1", "tail1": "tail2", "tail2": "tail3",
    "thighL0": "shinL0", "shinL0": "footL0", "footL0": "toeL0", "thighR0": "shinR0", "shinR0": "footR0", "footR0": "toeR0",
    "thighL1": "shinL1", "shinL1": "footL1", "footL1": "toeL1", "thighR1": "shinR1", "shinR1": "footR1", "footR1": "toeR1",
}


TAU = {"hips": .04, "spin": .045, "ches": .04, "neck": .04, "head": .03, "tail": .045, "earL": .015, "earR": .015}
TAU_LEG = .02


def load(path):
    d = bytearray(open(path, "rb").read())
    jl = struct.unpack("<I", d[12:16])[0]
    j = json.loads(bytes(d[20:20 + jl]))
    bl = struct.unpack("<I", d[20 + jl:24 + jl])[0]
    return d, j, 20 + jl + 8, bl


def acc_view(d, j, b0, i):
    a = j["accessors"][i]; v = j["bufferViews"][a["bufferView"]]
    off = b0 + v.get("byteOffset", 0) + a.get("byteOffset", 0)
    return off, CT[a["componentType"]], NC[a["type"]], a["count"]


def get(d, j, b0, i):
    off, ct, n, c = acc_view(d, j, b0, i)
    return np.frombuffer(bytes(d), ct, c * n, off).reshape(c, n).copy()


def put(d, j, b0, i, arr):
    off, ct, n, c = acc_view(d, j, b0, i)
    arr = np.ascontiguousarray(arr.astype(ct)).reshape(-1)
    assert arr.size == c * n
    d[off:off + arr.nbytes] = arr.tobytes()


def centerline(pos):
    Z, C = [], []
    for z0 in np.arange(-.36, .40, .03):
        m = (pos[:, 2] >= z0) & (pos[:, 2] < z0 + .03) & (pos[:, 1] > .2) & (pos[:, 1] < .5)
        if m.sum() < 200: continue
        lo, hi = np.percentile(pos[m, 0], [3, 97]); Z.append(z0 + .015); C.append((lo + hi) / 2)
    return np.poly1d(np.polyfit(Z, C, 4))


def unbend(pos, nrm):
    c = centerline(pos); dc = c.deriv()
    zg = np.linspace(-.6, .6, 2401)
    sg = np.concatenate([[0], np.cumsum(np.sqrt(1 + dc(zg[1:]) ** 2) * np.diff(zg))]); sg -= np.interp(0, zg, sg)
    x = pos[:, 0].astype(np.float64); z = pos[:, 2].astype(np.float64); zc = z.copy()
    for _ in range(8): zc = z + (x - c(zc)) * dc(zc)
    th = np.arctan(dc(zc)); ct, st = np.cos(th), np.sin(th)
    out = pos.copy().astype(np.float64)
    out[:, 0] = -(z - zc) * st + (x - c(zc)) * ct
    out[:, 2] = np.interp(zc, zg, sg)
    n = nrm.astype(np.float64); nn = n.copy()
    nn[:, 2] = n[:, 2] * ct + n[:, 0] * st; nn[:, 0] = -n[:, 2] * st + n[:, 0] * ct
    nn /= np.linalg.norm(nn, axis=1, keepdims=True)
    return out.astype(np.float32), nn.astype(np.float32)


def seg_dist(P, A, B):
    A = np.asarray(A, np.float64); B = np.asarray(B, np.float64); AB = B - A
    t = np.clip(((P - A) @ AB) / max(AB @ AB, 1e-9), 0, 1)
    return np.linalg.norm(P - (A + t[:, None] * AB), axis=1)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def skin(P, names):
    D, M = {}, {}
    x, y = P[:, 0].astype(np.float64), P[:, 1].astype(np.float64)
    for b in names:
        if b == "motion_root": continue
        if b in CHAIN: end = JOINT[CHAIN[b]]
        else: end = TIP[b]
        D[b] = seg_dist(P, JOINT[b], end)
        m = np.ones(len(P))
        if b[:5] in ("thigh", "shinL", "shinR", "footL", "footR") or b[:3] == "toe":
            side = b[-2]  # 'L' or 'R'
            front = b[-1] == "0"
            fade = np.clip(((.31 - y) / .09) if front else ((.36 - y) / .10), 0, 1)
            sm = smoothstep(-.005, .02, x) if side == "L" else smoothstep(.005, -.02, x)
            m = fade * sm
        if b in ("earL", "earR"):
            m = smoothstep(.54, .59, y) * (smoothstep(-.04, -.02, x) if b == "earL" else smoothstep(-.02, -.04, x))
        M[b] = m
    bn = list(D)
    d = np.stack([D[b] for b in bn], 1); mm = np.stack([M[b] for b in bn], 1)
    tau = np.array([TAU.get(b[:4], TAU_LEG if (b[:5] in ("thigh", "shinL", "shinR", "footL", "footR") or b[:3] == "toe") else .03) for b in bn])
    w = np.exp(-(d - d.min(1, keepdims=True)) / tau) * mm
    w[w.sum(1) < 1e-12] = 0
    # vertices where every candidate was masked out: fall back to nearest non-leg bone
    dead = w.sum(1) < 1e-12
    if dead.any():
        for k, b in enumerate(bn):
            if b[:5] in ("thigh", "shinL", "shinR", "footL", "footR") or b[:3] == "toe" or b[:3] == "ear": d[:, k] = 9
        w[dead] = np.exp(-(d[dead] - d[dead].min(1, keepdims=True)) / .03)
    top = np.argsort(-w, 1)[:, :4]
    wt = np.take_along_axis(w, top, 1); wt /= wt.sum(1, keepdims=True)
    # drop tiny weights, renormalise
    wt[wt < .02] = 0; wt /= wt.sum(1, keepdims=True)
    idx = np.array([names.index(bn[k]) for k in range(len(bn))])[top]
    return idx.astype(np.uint8), wt.astype(np.float32)


def local_matrix(n):
    t = np.array(n.get("translation", [0, 0, 0]), np.float64)
    q = np.array(n.get("rotation", [0, 0, 0, 1]), np.float64); s = np.array(n.get("scale", [1, 1, 1]), np.float64)
    x, y, z, w = q / np.linalg.norm(q)
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4); M[:3, :3] = R * s; M[:3, 3] = t; return M


def main(src, dst):
    d, j, b0, bl = load(src)
    prim = j["meshes"][0]["primitives"][0]; A = prim["attributes"]
    pos = get(d, j, b0, A["POSITION"]); nrm = get(d, j, b0, A["NORMAL"])
    sk = j["skins"][0]; names = [j["nodes"][n]["name"] for n in sk["joints"]]
    assert sorted(names) == sorted(JOINT), set(names) ^ set(JOINT)
    P, N = unbend(pos, nrm)
    ji, wt = skin(P, names)
    put(d, j, b0, A["POSITION"], P); put(d, j, b0, A["NORMAL"], N)
    put(d, j, b0, A["JOINTS_0"], ji); put(d, j, b0, A["WEIGHTS_0"], wt)
    pa = j["accessors"][A["POSITION"]]; pa["min"] = P.min(0).tolist(); pa["max"] = P.max(0).tolist()
    # re-place joints: keep rotation/scale, solve local translation from desired world position
    par = {}
    for i, n in enumerate(j["nodes"]):
        for c in n.get("children", []): par[c] = i
    nid = {j["nodes"][n]["name"]: n for n in sk["joints"]}
    world = {}

    def W(i):
        if i in world: return world[i]
        L = local_matrix(j["nodes"][i]); world[i] = (W(par[i]) @ L) if i in par else L
        return world[i]
    order = sorted(nid.values(), key=lambda i: len(chain(i, par)))
    for i in order:
        name = j["nodes"][i]["name"]
        Wp = W(par[i]) if i in par else np.eye(4)
        loc = np.linalg.inv(Wp) @ np.array([*JOINT[name], 1.0])
        j["nodes"][i]["translation"] = [float(v) for v in loc[:3]]
        world.pop(i, None)
    ibm = np.stack([np.linalg.inv(W(nid[n])).T for n in names]).astype(np.float32)
    for k, n in enumerate(names):  # sanity: bind world position == target
        assert np.allclose(W(nid[n])[:3, 3], JOINT[n], atol=1e-5), n
    put(d, j, b0, sk["inverseBindMatrices"], ibm.reshape(len(names), 16))
    # rebuild container with the new JSON chunk
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    binchunk = bytes(d[20 + struct.unpack("<I", d[12:16])[0]:])
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + len(binchunk)) + struct.pack("<II", len(js), 0x4E4F534A) + js + binchunk
    open(dst, "wb").write(out)
    print("wrote", dst, len(out), "bytes; bbox", P.min(0).round(3), P.max(0).round(3))


def chain(i, par):
    c = []
    while i in par: i = par[i]; c.append(i)
    return c


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
