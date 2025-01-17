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

import debounce from "lodash/debounce";
import { DisplayContext } from "#/display_context";
import { UserLayer, UserLayerConstructor } from "#/layer";
import { registerTool, ToolActivation } from "#/ui/tool";
import { RefCounted } from "#/util/disposable";
import { removeChildren } from "#/util/dom";
import { verifyObjectProperty, verifyString } from "#/util/json";
import { AnyConstructor } from "#/util/mixin";
import { WatchableVisibilityPriority } from "#/visibility_priority/frontend";
import {
  ParameterizedEmitterDependentShaderOptions,
  ParameterizedShaderGetterResult,
} from "#/webgl/dynamic_shader";
import { ShaderControlState } from "#/webgl/shader_ui_controls";
import {
  addLayerControlToOptionsTab,
  LayerControlDefinition,
  LayerControlFactory,
  LayerControlTool,
} from "#/widget/layer_control";
import { channelInvlerpLayerControl } from "#/widget/layer_control_channel_invlerp";
import { checkboxLayerControl } from "#/widget/layer_control_checkbox";
import { colorLayerControl } from "#/widget/layer_control_color";
import { propertyInvlerpLayerControl } from "#/widget/layer_control_property_invlerp";
import { rangeLayerControl } from "#/widget/layer_control_range";
import { Tab } from "#/widget/tab_view";

export interface LegendShaderOptions
  extends ParameterizedEmitterDependentShaderOptions {
  initializeShader: (shaderResult: ParameterizedShaderGetterResult) => void;
}

export interface ShaderControlsOptions {
  legendShaderOptions?: LegendShaderOptions;
  visibility?: WatchableVisibilityPriority;
  toolId?: string;
}

function getShaderLayerControlFactory<LayerType extends UserLayer>(
  layerShaderControls: LayerShaderControls,
  controlId: string,
): LayerControlFactory<LayerType> | undefined {
  const { shaderControlState } = layerShaderControls;
  const controlState = shaderControlState.state.get(controlId);
  if (controlState === undefined) return undefined;
  const { control } = controlState;
  switch (control.type) {
    case "slider":
      return rangeLayerControl(() => ({
        value: controlState.trackable,
        options: { min: control.min, max: control.max, step: control.step },
      }));
    case "color":
      return colorLayerControl(() => controlState.trackable);
    case "checkbox":
      return checkboxLayerControl(() => controlState.trackable);
    case "imageInvlerp": {
      let histogramIndex = 0;
      for (const [
        otherName,
        {
          control: { type: otherType },
        },
      ] of shaderControlState.state) {
        if (otherName === controlId) break;
        if (otherType === "imageInvlerp") ++histogramIndex;
      }
      return channelInvlerpLayerControl(() => ({
        dataType: control.dataType,
        defaultChannel: control.default.channel,
        watchableValue: controlState.trackable,
        channelCoordinateSpaceCombiner:
          shaderControlState.channelCoordinateSpaceCombiner,
        histogramSpecifications: shaderControlState.histogramSpecifications,
        histogramIndex,
        legendShaderOptions: layerShaderControls.legendShaderOptions,
      }));
    }
    case "propertyInvlerp": {
      let histogramIndex = 0;
      for (const [
        otherName,
        {
          control: { type: otherType },
        },
      ] of shaderControlState.state) {
        if (otherName === controlId) break;
        if (otherType === "propertyInvlerp") ++histogramIndex;
      }
      return propertyInvlerpLayerControl(() => ({
        properties: control.properties,
        watchableValue: controlState.trackable,
        histogramSpecifications: shaderControlState.histogramSpecifications,
        histogramIndex,
        legendShaderOptions: layerShaderControls.legendShaderOptions,
      }));
    }
  }
}

function getShaderLayerControlDefinition<LayerType extends UserLayer>(
  getter: (layer: LayerType) => LayerShaderControls,
  toolId: string,
  controlId: string,
): LayerControlDefinition<LayerType> {
  return {
    label: controlId,
    toolJson: shaderControlToolJson(controlId, toolId),
    makeControl: (layer, context, options) => {
      const layerShaderControls = getter(layer);
      return getShaderLayerControlFactory(
        layerShaderControls,
        controlId,
      )!.makeControl(layer, context, options);
    },
    activateTool: (activation, control) => {
      const layerShaderControls = getter(activation.tool.layer);
      return getShaderLayerControlFactory(
        layerShaderControls,
        controlId,
      )!.activateTool(activation, control);
    },
  };
}

export class ShaderControls extends Tab {
  private controlDisposer: RefCounted | undefined = undefined;
  private toolId: string;
  constructor(
    public state: ShaderControlState,
    public display: DisplayContext,
    public layer: UserLayer,
    public options: ShaderControlsOptions = {},
  ) {
    super(options.visibility);
    const { toolId = SHADER_CONTROL_TOOL_ID } = options;
    this.toolId = toolId;
    const { element } = this;
    element.style.display = "contents";
    const { controls } = state;
    this.registerDisposer(
      controls.changed.add(
        this.registerCancellable(debounce(() => this.updateControls(), 0)),
      ),
    );
    this.updateControls();
  }

  updateControls() {
    const { element } = this;
    if (this.controlDisposer !== undefined) {
      this.controlDisposer.dispose();
      removeChildren(element);
    }
    const controlDisposer = (this.controlDisposer = new RefCounted());
    const layerShaderControlsGetter = () => ({
      shaderControlState: this.state,
      legendShaderOptions: this.options.legendShaderOptions,
    });
    for (const name of this.state.state.keys()) {
      element.appendChild(
        addLayerControlToOptionsTab(
          controlDisposer,
          this.layer,
          this.visibility,
          getShaderLayerControlDefinition(
            layerShaderControlsGetter,
            this.toolId,
            name,
          ),
        ),
      );
    }
  }

  disposed() {
    this.controlDisposer?.dispose();
    super.disposed();
  }
}

interface LayerShaderControls {
  shaderControlState: ShaderControlState;
  legendShaderOptions?: LegendShaderOptions;
}

export const SHADER_CONTROL_TOOL_ID = "shaderControl";
const CONTROL_JSON_KEY = "control";

function shaderControlToolJson(control: string, toolId: string) {
  return { type: toolId, [CONTROL_JSON_KEY]: control };
}

class ShaderControlTool extends LayerControlTool {
  constructor(
    layer: UserLayer,
    private layerShaderControls: LayerShaderControls,
    toolId: string,
    private control: string,
  ) {
    super(
      layer,
      getShaderLayerControlDefinition(
        () => layerShaderControls,
        toolId,
        control,
      ),
    );
    this.registerDisposer(
      layerShaderControls.shaderControlState.controls.changed.add(
        this.registerCancellable(
          debounce(() => {
            if (
              layerShaderControls.shaderControlState.state.get(control) ===
              undefined
            ) {
              this.unbind();
            }
          }),
        ),
      ),
    );
  }
  activate(activation: ToolActivation<this>) {
    const { shaderControlState } = this.layerShaderControls;
    const controlState = shaderControlState.state.get(this.control);
    if (controlState === undefined) return;
    super.activate(activation);
  }
}

export function registerLayerShaderControlsTool<LayerType extends UserLayer>(
  layerType: UserLayerConstructor & AnyConstructor<LayerType>,
  getter: (layer: LayerType) => LayerShaderControls,
  toolId: string = SHADER_CONTROL_TOOL_ID,
) {
  registerTool(layerType, toolId, (layer, options) => {
    const control = verifyObjectProperty(
      options,
      CONTROL_JSON_KEY,
      verifyString,
    );
    return new ShaderControlTool(layer, getter(layer), toolId, control);
  });
}
