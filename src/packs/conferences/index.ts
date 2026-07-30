import type { IndustryPack, IndustryPackContext } from '../types.js';
import { registerConferenceTools } from './tool.js';

export const conferencesPack: IndustryPack = {
  id: 'conferences',
  replacesTicketTools: true,
  register(context: IndustryPackContext): string[] {
    return registerConferenceTools(
      context.adapter,
      context.config,
      context.client,
      context.toolPrefix,
    );
  },
};
