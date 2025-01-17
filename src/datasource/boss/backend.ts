/**
 * @license
 * Copyright 2017 Google Inc.
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

import { WithParameters } from "#/chunk_manager/backend";
import { ChunkSourceParametersConstructor } from "#/chunk_manager/base";
import { WithSharedCredentialsProviderCounterpart } from "#/credentials_provider/shared_counterpart";
import { BossToken, fetchWithBossCredentials } from "#/datasource/boss/api";
import {
  MeshSourceParameters,
  VolumeChunkSourceParameters,
} from "#/datasource/boss/base";
import {
  assignMeshFragmentData,
  decodeJsonManifestChunk,
  decodeTriangleVertexPositionsAndIndices,
  FragmentChunk,
  ManifestChunk,
  MeshSource,
} from "#/mesh/backend";
import { ChunkDecoder } from "#/sliceview/backend_chunk_decoders";
import { decodeBossNpzChunk } from "#/sliceview/backend_chunk_decoders/bossNpz";
import { decodeJpegChunk } from "#/sliceview/backend_chunk_decoders/jpeg";
import { VolumeChunk, VolumeChunkSource } from "#/sliceview/volume/backend";
import { CancellationToken } from "#/util/cancellation";
import { Endianness } from "#/util/endian";
import { cancellableFetchOk, responseArrayBuffer } from "#/util/http_request";
import { registerSharedObject, SharedObject } from "#/worker_rpc";

const chunkDecoders = new Map<string, ChunkDecoder>();
chunkDecoders.set("npz", decodeBossNpzChunk);
chunkDecoders.set("jpeg", decodeJpegChunk);

const acceptHeaders = new Map<string, string>();
acceptHeaders.set("npz", "application/npygz");
acceptHeaders.set("jpeg", "image/jpeg");

function BossSource<
  Parameters,
  TBase extends { new (...args: any[]): SharedObject },
>(
  Base: TBase,
  parametersConstructor: ChunkSourceParametersConstructor<Parameters>,
) {
  return WithParameters(
    WithSharedCredentialsProviderCounterpart<BossToken>()(Base),
    parametersConstructor,
  );
}

@registerSharedObject()
export class BossVolumeChunkSource extends BossSource(
  VolumeChunkSource,
  VolumeChunkSourceParameters,
) {
  chunkDecoder = chunkDecoders.get(this.parameters.encoding)!;

  async download(chunk: VolumeChunk, cancellationToken: CancellationToken) {
    const { parameters } = this;
    let url = `${parameters.baseUrl}/latest/cutout/${parameters.collection}/${parameters.experiment}/${parameters.channel}/${parameters.resolution}`;
    {
      // chunkPosition must not be captured, since it will be invalidated by the next call to
      // computeChunkBounds.
      const chunkPosition = this.computeChunkBounds(chunk);
      const chunkDataSize = chunk.chunkDataSize!;
      for (let i = 0; i < 3; ++i) {
        url += `/${chunkPosition[i]}:${chunkPosition[i] + chunkDataSize[i]}`;
      }
    }
    url += "/";

    if (parameters.window !== undefined) {
      url += `?window=${parameters.window[0]},${parameters.window[1]}`;
    }
    const response = await fetchWithBossCredentials(
      this.credentialsProvider,
      url,
      { headers: { Accept: acceptHeaders.get(parameters.encoding)! } },
      responseArrayBuffer,
      cancellationToken,
    );
    await this.chunkDecoder(chunk, cancellationToken, response);
  }
}

function decodeManifestChunk(chunk: ManifestChunk, response: any) {
  return decodeJsonManifestChunk(chunk, response, "fragments");
}

function decodeFragmentChunk(chunk: FragmentChunk, response: ArrayBuffer) {
  const dv = new DataView(response);
  const numVertices = dv.getUint32(0, true);
  assignMeshFragmentData(
    chunk,
    decodeTriangleVertexPositionsAndIndices(
      response,
      Endianness.LITTLE,
      /*vertexByteOffset=*/ 4,
      numVertices,
    ),
  );
}

@registerSharedObject()
export class BossMeshSource extends BossSource(
  MeshSource,
  MeshSourceParameters,
) {
  download(chunk: ManifestChunk, cancellationToken: CancellationToken) {
    const { parameters } = this;
    return cancellableFetchOk(
      `${parameters.baseUrl}${chunk.objectId}`,
      {},
      responseArrayBuffer,
      cancellationToken,
    ).then((response) => decodeManifestChunk(chunk, response));
  }

  downloadFragment(chunk: FragmentChunk, cancellationToken: CancellationToken) {
    const { parameters } = this;
    return cancellableFetchOk(
      `${parameters.baseUrl}${chunk.fragmentId}`,
      {},
      responseArrayBuffer,
      cancellationToken,
    ).then((response) => decodeFragmentChunk(chunk, response));
  }
}
