/**
 * @license
 * Copyright 2019 Google Inc.
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

import { CancellationToken } from "#/util/cancellation";
import { getByteRangeHeader, responseArrayBuffer } from "#/util/http_request";
import {
  cancellableFetchSpecialOk,
  SpecialProtocolCredentialsProvider,
} from "#/util/special_protocol_request";
import { Uint64 } from "#/util/uint64";

/**
 * On Chromium, multiple concurrent byte range requests to the same URL are serialized unless the
 * cache is disabled.  Disabling the cache works around the problem.
 *
 * https://bugs.chromium.org/p/chromium/issues/detail?id=969828
 */
const cacheMode =
  navigator.userAgent.indexOf("Chrome") !== -1 ? "no-store" : "default";

export function fetchSpecialHttpByteRange(
  credentialsProvider: SpecialProtocolCredentialsProvider,
  url: string,
  startOffset: Uint64 | number,
  endOffset: Uint64 | number,
  cancellationToken: CancellationToken,
): Promise<ArrayBuffer> {
  return cancellableFetchSpecialOk(
    credentialsProvider,
    url,
    {
      headers: getByteRangeHeader(startOffset, endOffset),
      cache: cacheMode,
    },
    responseArrayBuffer,
    cancellationToken,
  );
}
