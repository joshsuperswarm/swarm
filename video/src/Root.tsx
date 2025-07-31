import { Composition } from 'remotion';
import { SwarmAdvertisement } from './SwarmAdvertisement';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="SwarmAdvertisement"
        component={SwarmAdvertisement}
        durationInFrames={735} // 24.5 seconds at 30fps
        width={3840}
        height={2160}
        fps={30}
        defaultProps={{}}
      />
    </>
  );
};