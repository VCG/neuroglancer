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

import { registerEventListener } from "#/util/disposable";

export function setClipboard(data: string, format = "text/plain") {
  let success = false;
  const cleanup = registerEventListener(
    document,
    "copy",
    (event: ClipboardEvent) => {
      const { clipboardData } = event;
      if (clipboardData !== null) {
        clipboardData.setData(format, data);
        success = true;
      }
      event.stopPropagation();
      event.preventDefault();
    },
    true,
  );
  try {
    document.execCommand("copy");
  } finally {
    cleanup();
  }
  return success;
}
