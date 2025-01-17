/**
 * @license
 * Copyright 2022 William Silvermsith.
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

import { DATA_TYPE_BYTES } from "#/util/data_type";
import { decodeRawChunk } from "#/sliceview/backend_chunk_decoders/raw";
import { VolumeChunk } from "#/sliceview/volume/backend";
import { CancellationToken } from "#/util/cancellation";
import { decodePng } from "#/async_computation/decode_png_request";
import { requestAsyncComputation } from "#/async_computation/request";

export async function decodePngChunk(
  chunk: VolumeChunk,
  cancellationToken: CancellationToken,
  response: ArrayBuffer,
) {
  const chunkDataSize = chunk.chunkDataSize!;
  const dataType = chunk.source!.spec.dataType;
  const { uint8Array: image } = await requestAsyncComputation(
    decodePng,
    cancellationToken,
    [response],
    /*buffer=*/ new Uint8Array(response),
    /*width=*/ chunkDataSize[0],
    /*height=*/ chunkDataSize[1] * chunkDataSize[2],
    /*numComponents=*/ chunkDataSize[3] || 1,
    /*bytesPerPixel=*/ DATA_TYPE_BYTES[dataType],
    /*convertToGrayscale=*/ false,
  );

  await decodeRawChunk(chunk, cancellationToken, image.buffer);
}
