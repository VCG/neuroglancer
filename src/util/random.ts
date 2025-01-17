/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { TypedArray } from "#/util/array";

export function getRandomHexString(numBits = 128) {
  const numValues = Math.ceil(numBits / 32);
  const data = new Uint32Array(numValues);
  crypto.getRandomValues(data);
  let s = "";
  for (let i = 0; i < numValues; ++i) {
    s += ("00000000" + data[i].toString(16)).slice(-8);
  }
  return s;
}

/**
 * Calls crypto.getRandomValues as many times as needed to fill array.
 */
export function getRandomValues<T extends TypedArray>(array: T): T {
  const byteArray = new Uint8Array(
    array.buffer,
    array.byteOffset,
    array.byteLength,
  );
  const blockSize = 65536;
  for (let i = 0, length = byteArray.length; i < length; i += blockSize) {
    crypto.getRandomValues(
      byteArray.subarray(i, Math.min(length, i + blockSize)),
    );
  }
  return array;
}

export function getRandomUint32() {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return data[0];
}
