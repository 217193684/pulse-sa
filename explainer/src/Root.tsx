import React from 'react';
import {Composition} from 'remotion';
import {Explainer, FPS, type Props} from './Explainer';
import {Thumb} from './Thumb';

const empty: Props = {script: {id: 'empty', title: '', caseNo: '', date: '', scenes: [], sources: []}, timing: {duration: 1, scenes: []}};

/** The episode (script + timing) comes in as props: `remotion render ... --props=episode.json` */
export const Root: React.FC = () => (
  <>
    <Composition
      id="Explainer"
      component={Explainer}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={30}
      defaultProps={empty}
      calculateMetadata={({props}) => ({durationInFrames: Math.max(30, Math.ceil(props.timing.duration * FPS))})}
    />
    <Composition id="Thumb" component={Thumb} fps={FPS} width={1280} height={720} durationInFrames={1} defaultProps={empty} />
  </>
);
