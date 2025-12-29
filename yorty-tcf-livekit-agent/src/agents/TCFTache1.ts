import { TCFAgent } from './TCFAgent.js';

/**
 * Agent pour TCF Tâche 1 - Expression Orale
 * Configuration chargée depuis config/agents/tache1.yml
 */
export class TCFTache1 extends TCFAgent {
  constructor() {
    super('tache1');
  }
}