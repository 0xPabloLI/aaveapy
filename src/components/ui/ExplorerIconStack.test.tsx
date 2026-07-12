// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ExplorerIconStack } from './ExplorerIconStack';

afterEach(() => cleanup());

describe('ExplorerIconStack', () => {
  it('renders both chain and explorer icons in a stacked container', () => {
    render(
      <ExplorerIconStack
        chainIconSrc="/icons/networks/ethereum.svg"
        chainName="Ethereum"
        explorerIconSrc="/icons/explorers/etherscan.svg"
        explorerName="Etherscan"
      />,
    );

    expect(screen.getByAltText('Ethereum')).toBeInTheDocument();
    expect(screen.getByAltText('Etherscan')).toBeInTheDocument();
  });

  it('renders the chain icon only when explorer is missing', () => {
    render(
      <ExplorerIconStack
        chainIconSrc="/icons/networks/ethereum.svg"
        chainName="Ethereum"
        explorerIconSrc={undefined}
        explorerName="Etherscan"
      />,
    );

    expect(screen.getByAltText('Ethereum')).toBeInTheDocument();
    expect(screen.queryByAltText('Etherscan')).not.toBeInTheDocument();
  });

  it('renders the explorer icon only when chain is missing', () => {
    render(
      <ExplorerIconStack
        chainIconSrc={undefined}
        chainName="Ethereum"
        explorerIconSrc="/icons/explorers/etherscan.svg"
        explorerName="Etherscan"
      />,
    );

    expect(screen.queryByAltText('Ethereum')).not.toBeInTheDocument();
    expect(screen.getByAltText('Etherscan')).toBeInTheDocument();
  });

  it('renders nothing when both icons are missing', () => {
    const { container } = render(
      <ExplorerIconStack
        chainIconSrc={undefined}
        chainName="Ethereum"
        explorerIconSrc={undefined}
        explorerName="Etherscan"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
