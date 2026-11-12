import { Code2, Cpu, Dna, Flag } from 'lucide-react';
import { useNavigationLab } from '@/features/navigation/state/labStore';
import type { Tour } from '@/ui/walkthrough/types';
import { keepNavigationTraining, navigationFlatOut, watchNavigationLive } from './navigationTourActions';

const LEARN = 'How it learns';
const MOVE = 'How it moves';
const YOURS = 'Your turn';
const lab = () => useNavigationLab.getState();

/**
 * The Navigation lab tour. First how a population of runners learns and
 * climbs the levels, then what one runner senses, then the Studio. A few
 * steps wait for the user to press the real control.
 */
export const NAVIGATION_TOUR: Tour = {
  id: 'navigation',
  storageKey: 'sandboxlab.tour.navigation',
  pageOwnsEscape: () => lab().focus.kind !== 'champion',
  intro: {
    title: 'Welcome to the Navigation lab',
    body: 'These runners teach themselves to reach the finish line. First how they learn, then how a trained one moves.',
    icon: <Flag />,
    chapters: [
      { label: LEARN, icon: <Dna /> },
      { label: MOVE, icon: <Cpu /> },
      { label: YOURS, icon: <Code2 /> },
    ],
  },
  steps: [
    {
      id: 'train',
      chapter: LEARN,
      target: '[data-tour="train"]',
      prefer: ['top', 'right'],
      title: 'Every runner has a brain',
      body: 'A small neural network moves each runner. It starts random, so most of them wander.',
      action: {
        prompt: 'Press Train',
        shortcut: 'Space',
        done: () => lab().status === 'running',
        doneLabel: 'Training',
        then: {
          target: '[data-tour="viewport"]',
          title: 'Fitness is the score',
          body: 'A runner scores for every bit of new ground, more for crossing the line, and loses some for dying on spikes.',
        },
      },
    },
    {
      id: 'parents',
      chapter: LEARN,
      target: '[data-tour="generation"]',
      fallback: '[data-tour="hud-generation"]',
      prefer: ['top'],
      prepare: () => void keepNavigationTraining(),
      title: 'The best become parents',
      body: 'When every run is over, the best runners breed the next generation: copies and mixes of them, with small changes.',
      terms: [
        { term: 'Mutation', meaning: 'Small random changes. Weights shift, and sometimes a new link or neuron appears.' },
        { term: 'Crossover', meaning: 'A child that mixes the links of two parents.' },
      ],
    },
    {
      id: 'level',
      chapter: LEARN,
      target: '[data-tour="hud-level"]',
      prefer: ['bottom', 'right'],
      prepare: () => void keepNavigationTraining(),
      title: 'Harder courses as they learn',
      body: 'Level 0 is a straight run across an empty room. Once the best fifth finishes three quarters of their courses, over two generations, the next level adds crates, spikes, walls or moving blocks.',
    },
    {
      id: 'progress',
      chapter: LEARN,
      target: '[data-tour="curriculum"]',
      fallback: '[data-tour="panel"]',
      prefer: ['left'],
      prepare: () => lab().set({ panelTab: 'progress' }),
      title: 'Watch it climb',
      body: 'The level per generation, and below it the share of runs that finished. The best fifth leads; the rest catch up.',
    },
    {
      id: 'speed',
      chapter: LEARN,
      target: '[data-tour="speed"]',
      prefer: ['top'],
      prepare: () => void keepNavigationTraining(),
      title: 'Train faster',
      body: '1x to 4x let you watch. Turbo and Max train flat out on every core.',
      action: {
        prompt: 'Pick Turbo',
        done: navigationFlatOut,
        doneLabel: 'Training flat out',
        then: {
          title: 'Learning in the background',
          body: 'Generations now finish in a blink. Turbo replays the latest champion on the newest course. Next, back to 1x to watch one runner.',
        },
      },
    },
    {
      id: 'inputs',
      chapter: MOVE,
      target: '[data-tour="inputs"]',
      prefer: ['bottom', 'left'],
      prepare: () => void watchNavigationLive(),
      title: 'A network only sees numbers',
      body: 'A network starts from its inputs. Press Inputs to draw what the followed runner senses.',
      action: {
        prompt: 'Press Inputs',
        shortcut: 'I',
        done: () => lab().inputsOverlay,
        doneLabel: 'Inputs on',
        then: {
          target: '[data-tour="viewport"]',
          title: 'What the runner senses',
          body: 'Each beam measures the distance to a wall, a crate, spikes or a mover. The green arrow points to the finish and the dots show the shortest way round.',
        },
      },
    },
    {
      id: 'network',
      chapter: MOVE,
      target: '[data-tour="tab-network"]',
      prefer: ['left', 'bottom'],
      prepare: () => void watchNavigationLive(),
      title: 'Look inside the champion',
      body: 'The Network tab shows the best runner of the last generation.',
      action: {
        prompt: 'Open the Network tab',
        done: () => lab().panelTab === 'network',
        doneLabel: 'Network open',
        then: {
          target: '[data-tour="panel"]',
          title: 'This is the model running',
          body: 'Every tick, inputs on the left flow through the links to move and turn on the right. Busy links light up.',
          terms: [
            { term: 'Weight', meaning: 'How strongly a link passes its signal. Blue keeps the sign, orange flips it.' },
            { term: 'Hidden neuron', meaning: 'A neuron between inputs and outputs. Mutation adds them, so networks grow deeper as they learn.' },
          ],
        },
      },
    },
    {
      id: 'ghosts',
      chapter: MOVE,
      target: '[data-tour="view"]',
      prefer: ['bottom', 'left'],
      title: 'Ghosts of past champions',
      body: 'Overlay and Both replay earlier champions as ghosts on the same course. The gap between them is what training bought.',
    },
    {
      id: 'sandbox',
      chapter: MOVE,
      target: '[data-tour="sandbox"]',
      prefer: ['top'],
      title: 'Run them anywhere',
      body: 'The Sandbox puts your champions on any course, even one you draw. It can also play a model trained with each preset. Nothing learns there.',
    },
    {
      id: 'studio',
      chapter: YOURS,
      target: '[data-tour="nav-studio"]',
      prefer: ['bottom'],
      title: 'Write the rules yourself',
      body: 'In the Studio you write the training script: what earns fitness, when a run ends and when the level goes up. Replay this tour from the ? button.',
      links: [{ label: 'Start the first lesson', href: '/studio?lesson=navigation-01-first-run' }],
    },
  ],
};
