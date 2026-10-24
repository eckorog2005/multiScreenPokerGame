import { Link } from 'react-router';

function Landing() {
  return (
    <main>
      <h1>Multi-Screen Poker</h1>
      <nav>
        <Link to="/table">Host a Table</Link>
        <Link to="/play">Join a Game</Link>
      </nav>
    </main>
  );
}

export default Landing;
