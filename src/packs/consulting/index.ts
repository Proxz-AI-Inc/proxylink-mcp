import type { IndustryPack, IndustryPackContext } from '../types.js';
import { registerConsultingScheduleCallTool } from './tool.js';

export const consultingPack: IndustryPack = {
  id: 'consulting',
  register(context: IndustryPackContext): string[] {
    const toolName = registerConsultingScheduleCallTool(
      context.adapter,
      context.config,
      context.profile,
      context.toolPrefix,
    );
    return [toolName];
  },
};
