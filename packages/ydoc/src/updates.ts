/**
 * Yjs update 工具（05 §4 / 08 §4）。
 * 注意编码桥接：update 二进制 ≠ state vector 编码——
 * 从 update 取 SV 必须用 Y.encodeStateVectorFromUpdate（不能对 SV 再 decode）。
 */
import * as Y from 'yjs'

/** 合并多条 update 为等价的单条 update（幂等、可乱序） */
export function mergeUpdates(updates: Uint8Array[]): Uint8Array {
  return Y.mergeUpdates(updates)
}

/** 快照（state update 形态）+ 其后的增量 → 当前全量状态 */
export function buildPageState(snapshot: Uint8Array | null, updates: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = []
  if (snapshot) parts.push(snapshot)
  parts.push(...updates)
  return parts.length === 1 ? parts[0]! : Y.mergeUpdates(parts)
}

/** 从（合并后的）state update 取 state vector */
export function stateVectorFromUpdate(update: Uint8Array): Uint8Array {
  return Y.encodeStateVectorFromUpdate(update)
}

/** 用客户端 state vector 差分出服务端多出的部分（08 §4.1 pull） */
export function diffUpdate(update: Uint8Array, clientStateVector: Uint8Array | null): Uint8Array {
  if (!clientStateVector || clientStateVector.length === 0) return update
  return Y.diffUpdate(update, clientStateVector)
}

/** 将 update 应用到新 Y.Doc（提取/校验用） */
export function loadYDoc(update: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, update)
  return doc
}

/** Y.Doc → 全量 state update（入库快照形态） */
export function encodeDocState(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc)
}

/** base64 编解码（doc 端点 query/body 传输用） */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
