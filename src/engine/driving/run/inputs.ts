import type { RunConfig } from '../../training/runConfig';
import type { DrivingBlueprint } from '../blueprints';
import type { DrivingInputConfig } from '../sensors/inputConfig';

/**
 * The Driving sensor config of a run, or a throw for a run of another env.
 * It has a file of its own with type imports only, because the env's info
 * reads it and the info must stay clear of the simulation.
 */
export function drivingInputsOf(config: RunConfig): DrivingInputConfig {
  if (config.env !== 'driving' || config.blueprint.env !== 'driving') throw new Error('Not a driving run');
  return (config.blueprint as unknown as DrivingBlueprint).inputs;
}
