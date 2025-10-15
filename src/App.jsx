import React, { useState, useEffect, useRef } from 'react';
import { MantineProvider, Container, Title, Text, Button, Group, Paper, Stack, Anchor, Loader } from '@mantine/core';
import '@mantine/core/styles.css';

const Coindle = () => {
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState(null);
  const coinRef = useRef(null);
  const floorRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || 'secret-key';

  useEffect(() => {
    checkIfPlayedToday();
  }, []);

  const getTodayDate = () => {
    const today = new Date();
    return `${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`;
  };

  const getTimeUntilNextUTCDay = () => {
    const now = new Date();
    const tomorrowUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    
    const diff = tomorrowUTC - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  const checkIfPlayedToday = async () => {
    const lastPlayDate = JSON.parse(localStorage.getItem('coindleLastPlay') || '{}');
    const today = getTodayDate();
    
    if (lastPlayDate.date === today) {
      setHasPlayedToday(true);
      setScore(lastPlayDate.score || 0);
      setGameOver(true);
      
      // Fetch stats with percentile
      try {
        const statsResponse = await fetch(`${API_URL}/stats/${lastPlayDate.score || 0}`);
        const statsData = await statsResponse.json();
        setStats(statsData);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    }
  };

  const generateToken = async (score, date) => {
    const message = `${score}:${date}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(SECRET_KEY);
    const messageData = encoder.encode(message);
    
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const submitScore = async (finalScore) => {
    try {
      const date = getTodayDate();
      const token = await generateToken(finalScore, date);

      const response = await fetch(`${API_URL}/submit-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score: finalScore,
          date,
          token
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        console.error('Error submitting score:', data.error);
      }
    } catch (error) {
      console.error('Error submitting score:', error);
    }
  };

  const saveGameState = (finalScore) => {
    const today = getTodayDate();
    localStorage.setItem('coindleLastPlay', JSON.stringify({
      date: today,
      score: finalScore
    }));
    
    // Submit score to server
    submitScore(finalScore);
  };

  const flipCoin = (choice) => {
    if (isFlipping || gameOver) return;

    setIsFlipping(true);
    setShowResult(false);
    setSelectedChoice(choice);

    // Remove any existing animation classes
    const coin = coinRef.current;
    const floor = floorRef.current;
    const lines = floor.querySelectorAll('.line');
    
    coin.classList.remove('anim');
    lines.forEach(line => line.classList.remove('anim'));

    // Determine result
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    
    // Set the rotation based on result
    // heads = 720deg (2 full rotations ending on heads)
    // tails = 900deg (2.5 full rotations ending on tails)
    const flips = result === 'heads' ? '720deg' : '900deg';
    document.documentElement.style.setProperty('--flips', flips);

    // Start animation
    setTimeout(() => {
      coin.classList.add('anim');
      lines.forEach(line => line.classList.add('anim'));

      // Wait for animation to complete (1s)
      setTimeout(() => {
        setLastResult(result);
        setShowResult(true);

        // Check win/lose after showing result
        setTimeout(() => {
          if (result === choice) {
            // Win
            const newScore = score + 1;
            setScore(newScore);
            setShowResult(false);
            setIsFlipping(false);
          } else {
            // Lose - set gameOver first, then isFlipping
            setGameOver(true);
            setHasPlayedToday(true);
            saveGameState(score);
            setIsFlipping(false);
          }
        }, 1000);
      }, 1000);
    }, 50);
  };

  const shareScore = () => {
    const scoreText = score === 0 ? '0 💩' : score + ' ' + '🪙'.repeat(score);
    const text = `Coindle ${getTodayDate()}\nStreak: ${scoreText}\n\nPlay at https://muhashi.com/coindle`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetForTomorrow = () => {
    const lastPlayDate = JSON.parse(localStorage.getItem('coindleLastPlay') || '{}');
    const today = getTodayDate();
    
    if (lastPlayDate.date !== today) {
      setScore(0);
      setGameOver(false);
      setHasPlayedToday(false);
      setShowResult(false);
      setLastResult(null);
    }
  };

  useEffect(() => {
    resetForTomorrow();
  }, []);

  return (
    <MantineProvider>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css?family=Raleway:900');
          
          :root {
            --flips: 720deg;
          }

          .coin-world {
            position: relative;
            width: 150px;
            height: 150px;
            margin: 40px auto;
          }

          .floor {
            position: absolute;
            width: 150px;
            height: 150px;
          }

          .floor .line {
            position: absolute;
            top: 50%;
            left: 50%;
            margin-top: -0.375px;
            width: 150px;
            height: 0.75px;
            transform-origin: center left;
            border-radius: 0.75px;
            background: linear-gradient(90deg, white 20%, transparent 20%);
            background-repeat: no-repeat;
            opacity: 0;
          }

          .floor .line.anim {
            animation: lines 0.6s ease-out forwards;
            animation-delay: 0.65s;
          }

          .floor .line:nth-child(1) { transform: rotate(30deg) scale(1.1); }
          .floor .line:nth-child(2) { transform: rotate(60deg); }
          .floor .line:nth-child(3) { transform: rotate(90deg) scale(1.1); }
          .floor .line:nth-child(4) { transform: rotate(120deg); }
          .floor .line:nth-child(5) { transform: rotate(150deg) scale(1.1); }
          .floor .line:nth-child(6) { transform: rotate(180deg); }
          .floor .line:nth-child(7) { transform: rotate(210deg) scale(1.1); }
          .floor .line:nth-child(8) { transform: rotate(240deg); }
          .floor .line:nth-child(9) { transform: rotate(270deg) scale(1.1); }
          .floor .line:nth-child(10) { transform: rotate(300deg); }
          .floor .line:nth-child(11) { transform: rotate(330deg) scale(1.1); }
          .floor .line:nth-child(12) { transform: rotate(360deg); }

          .coin {
            height: 150px;
            width: 150px;
            transform-style: preserve-3d;
            transform-origin: 50%;
            position: relative;
          }

          .coin.anim {
            animation: flip 1s linear forwards;
          }

          .coin:before,
          .coin:after {
            display: grid;
            place-items: center;
            position: absolute;
            height: 100%;
            width: 100%;
            border-radius: 50%;
            background: #f7941e;
            border: 12px solid #ffa64d;
            box-shadow: inset 0 0 0 3px #c67816;
            font-size: 60px;
            font-family: 'Raleway', sans-serif;
            color: #c67816;
            text-shadow: 1.5px 1.5px 0 #a86313, -1.5px -1.5px 0 #ffa64d;
            content: '';
          }

          .coin:before {
            transform: translateZ(12.5px);
            content: '👑';
          }

          .coin:after {
            transform: translateZ(-12.5px) rotateY(180deg) rotateZ(180deg);
            content: '🦅';
          }

          .coin .edge {
            transform: translateX(62.5px);
            transform-style: preserve-3d;
            backface-visibility: hidden;
          }

          .coin .edge .segment {
            height: 150px;
            width: 25px;
            position: absolute;
            transform-style: preserve-3d;
            backface-visibility: hidden;
          }

          .coin .edge .segment:before,
          .coin .edge .segment:after {
            content: '';
            display: block;
            height: 15px;
            width: 25px;
            position: absolute;
            transform: rotateX(84.375deg);
          }

          .coin .edge .segment:before {
            transform-origin: top center;
            background: repeating-linear-gradient(#c67816 0, #c67816 25%, #a86313 25%, #a86313 50%);
          }

          .coin .edge .segment:after {
            bottom: 0;
            transform-origin: center bottom;
            background: repeating-linear-gradient(#a86313 0, #a86313 25%, #c67816 25%, #c67816 50%);
          }

          .coin .edge .segment:nth-child(1) { transform: rotateY(90deg) rotateX(11.25deg); }
          .coin .edge .segment:nth-child(2) { transform: rotateY(90deg) rotateX(22.5deg); }
          .coin .edge .segment:nth-child(3) { transform: rotateY(90deg) rotateX(33.75deg); }
          .coin .edge .segment:nth-child(4) { transform: rotateY(90deg) rotateX(45deg); }
          .coin .edge .segment:nth-child(5) { transform: rotateY(90deg) rotateX(56.25deg); }
          .coin .edge .segment:nth-child(6) { transform: rotateY(90deg) rotateX(67.5deg); }
          .coin .edge .segment:nth-child(7) { transform: rotateY(90deg) rotateX(78.75deg); }
          .coin .edge .segment:nth-child(8) { transform: rotateY(90deg) rotateX(90deg); }
          .coin .edge .segment:nth-child(9) { transform: rotateY(90deg) rotateX(101.25deg); }
          .coin .edge .segment:nth-child(10) { transform: rotateY(90deg) rotateX(112.5deg); }
          .coin .edge .segment:nth-child(11) { transform: rotateY(90deg) rotateX(123.75deg); }
          .coin .edge .segment:nth-child(12) { transform: rotateY(90deg) rotateX(135deg); }
          .coin .edge .segment:nth-child(13) { transform: rotateY(90deg) rotateX(146.25deg); }
          .coin .edge .segment:nth-child(14) { transform: rotateY(90deg) rotateX(157.5deg); }
          .coin .edge .segment:nth-child(15) { transform: rotateY(90deg) rotateX(168.75deg); }
          .coin .edge .segment:nth-child(16) { transform: rotateY(90deg) rotateX(180deg); }

          @keyframes flip {
            0% { transform: rotateY(0) rotateX(0deg) scale(1); }
            10% { transform: rotateY(45deg) rotateX(calc(var(--flips) / 3)) scale(1.6); }
            60% { transform: rotateY(-30deg) rotateX(calc(var(--flips) / 1.5)) scale(2); }
            100% { transform: rotateY(0) rotateX(var(--flips)) scale(1); }
          }

          @keyframes lines {
            40% { opacity: 1; background-position: -120px 0; }
            70% { opacity: 1; background-position: 75px 0; }
            100% { opacity: 1; background-position: 150px 0; }
          }
        `}
      </style>
      <Container size="sm" style={{ minHeight: '100vh', paddingTop: '2rem' }}>
        <Stack align="center" gap="xl">
          <div style={{ textAlign: 'center' }}>
            <Title order={1} style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>
              🪙 Coindle
            </Title>
            <Text size="lg" c="dimmed">
              Get as many coin flips correct in a row as you can. Only one attempt per day.
            </Text>
          </div>

          <Paper shadow="md" p="xl" radius="lg" style={{ width: '100%', maxWidth: '400px' }}>
            <Stack align="center" gap="lg">
              <div style={{ textAlign: 'center' }}>
                <Text size="sm" c="dimmed" mb="xs">
                  Current Streak
                </Text>
                <Title order={2} style={{ fontSize: '2.5rem', color: '#228be6' }}>
                  {score}
                </Title>
              </div>

              {/* Coin Display */}
              <div className="coin-world">
                <div className="floor" ref={floorRef}>
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="line"></div>
                  ))}
                </div>
                <div className="coin" ref={coinRef}>
                  <div className="edge">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className="segment"></div>
                    ))}
                  </div>
                </div>
              </div>

              {showResult && (
                <Text 
                  size="xl" 
                  fw={700}
                  c={lastResult === 'heads' ? 'yellow' : 'gray'}
                  style={{ textTransform: 'uppercase' }}
                >
                  {lastResult}!
                </Text>
              )}

              {!gameOver && !isFlipping && (
                <>
                  <Text size="lg" fw={500} ta="center">
                    Choose your side:
                  </Text>
                  <Group gap="md">
                    <Button
                      size="lg"
                      onClick={() => flipCoin('heads')}
                      disabled={isFlipping}
                      style={{
                        background: 'linear-gradient(145deg, #ffd700, #ffed4e)',
                        color: '#000'
                      }}
                    >
                      👑 Heads
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => flipCoin('tails')}
                      disabled={isFlipping}
                      style={{
                        background: 'linear-gradient(145deg, #c0c0c0, #e8e8e8)',
                        color: '#000'
                      }}
                    >
                      🦅 Tails
                    </Button>
                  </Group>
                </>
              )}

              {gameOver && (
                <Stack align="center" gap="md" style={{ width: '100%' }}>
                  <Text size="xl" fw={700} c="red" ta="center">
                    Game Over!
                  </Text>
                  <Text size="md" c="dimmed" ta="center">
                    Final Streak: {score}
                  </Text>
                  
                  {stats && (
                    <Paper p="md" style={{ width: '100%', background: '#f8f9fa' }}>
                      <Stack gap="xs">
                        <Text size="sm" fw={700} ta="center">
                          📊 Today's Global Stats
                        </Text>
                        <Group gap="xl" justify="center">
                          <div style={{ textAlign: 'center' }}>
                            <Text size="xs" c="dimmed">Players</Text>
                            <Text size="lg" fw={700}>{stats.totalPlayers}</Text>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <Text size="xs" c="dimmed">Average</Text>
                            <Text size="lg" fw={700}>{stats.averageScore}</Text>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <Text size="xs" c="dimmed">Top Score</Text>
                            <Text size="lg" fw={700}>{stats.topScore}</Text>
                          </div>
                        </Group>
                        {stats.percentile !== null && stats.percentile !== 0 && (
                          <Text size="sm" ta="center" mt="xs" c="blue">
                            You're in the top {100 - stats.percentile}% of players! 🎉
                          </Text>
                        )}
                        {stats.percentile !== null && stats.percentile === 0 && score === 0 && (
                          <Text size="sm" ta="center" mt="xs" c="blue">
                            You literally have the worst score possible.
                            <br />
                            Congrats 🥳
                          </Text>
                        )}
                      </Stack>
                    </Paper>
                  )}

                  {!stats && (
                    <>
                      <Loader />
                      <Text size="sm" c="dimmed" ta="center">
                        Loading stats...
                      </Text>
                    </>
                  )}
                  
                  <Button
                    size="lg"
                    onClick={shareScore}
                    fullWidth
                    style={{ background: copied ? '#40c057' : '#228be6' }}
                  >
                    {copied ? '✓ Copied!' : '📋 Share Score'}
                  </Button>
                  <Text size="sm" c="dimmed" ta="center">
                    Next round in: {getTimeUntilNextUTCDay()}
                  </Text>
                </Stack>
              )}

              {isFlipping && (
                <Text size="lg" c="blue" fw={500}>
                  Flipping...
                </Text>
              )}
            </Stack>
          </Paper>

          <Text size="sm" c="dimmed" ta="center" pb="3rem">
            Game by <Anchor href="https://muhashi.com" target="_blank">muhashi</Anchor>.
          </Text>
        </Stack>
      </Container>
    </MantineProvider>
  );
};

export default Coindle;
