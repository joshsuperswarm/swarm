import { Composition } from 'remotion';
import { SwarmAdvertisement } from './SwarmAdvertisement';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="SwarmAdvertisement"
        component={SwarmAdvertisement}
        durationInFrames={795} // 26.5 seconds at 30fps
        width={1920}
        height={1080}
        fps={30}
        defaultProps={{}}
      />
    </>
  );
};