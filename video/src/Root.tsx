import { Composition } from 'remotion';
import { SwarmAdvertisement } from './SwarmAdvertisement';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="SwarmAdvertisement"
        component={SwarmAdvertisement}
        durationInFrames={755} // 25.17 seconds at 30fps
        width={1280}
        height={720}
        fps={30}
        defaultProps={{}}
      />
    </>
  );
};