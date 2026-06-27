import { AaveProvider as AaveV4Provider, AaveClient as AaveV4Client, production as v4Production } from '@aave/react';
import { AaveProvider as AaveV3Provider, AaveClient as AaveV3Client, production as v3Production } from '@aave/react-v3';
import type { ReactNode } from 'react';

const v4Client = AaveV4Client.create({ environment: v4Production });
const v3Client = AaveV3Client.create({ environment: v3Production });

export function AaveProviders({ children }: { children: ReactNode }) {
  return (
    <AaveV4Provider client={v4Client}>
      <AaveV3Provider client={v3Client}>
        {children}
      </AaveV3Provider>
    </AaveV4Provider>
  );
}
