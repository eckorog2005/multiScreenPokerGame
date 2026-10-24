import { useState } from 'react';
import type { Card } from '@poker/protocol';
import { cardText, isRed } from '../cards.ts';

function HoleCards({ cards }: { cards: readonly [Card, Card] }) {
  const [faceUp, setFaceUp] = useState(false);
  const hide = () => setFaceUp(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Hole Cards. Hold to see your cards"
      className="hole-cards"
      onPointerDown={() => setFaceUp(true)}
      onPointerUp={hide}
      onPointerCancel={hide}
      onPointerLeave={hide}
      onContextMenu={(event) => event.preventDefault()}
    >
      {cards.map((card, i) =>
        faceUp ? (
          <span key={i} className={isRed(card) ? 'card red' : 'card'}>
            {cardText(card)}
          </span>
        ) : (
          <span key={i} className="card back" aria-hidden="true" />
        ),
      )}
    </div>
  );
}

export default HoleCards;
