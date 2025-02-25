import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Card,
  Stack,
  ActionIcon,
  Tooltip,
  Loader,
} from '@mantine/core';
import { IconRefresh, IconArrowLeft } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface TokenStatus {
  id: string;
  status: 'available' | 'cooldown';
  error_count: number;
  cooldown_until: string | null;
}

interface PoolStatus {
  total_tokens: number;
  active_tokens: number;
  tokens: TokenStatus[];
}

interface TokenPoolStatusProps {
  isDark: boolean;
}

export function TokenPoolStatus({ isDark }: TokenPoolStatusProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<PoolStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:8000/api/pool-status');
      setStatus(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch token pool status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Container size="lg" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Group justify="space-between" mb="xl">
          <Group>
            <Tooltip label="Back to parser">
              <ActionIcon
                variant="outline"
                color={isDark ? 'blue' : 'blue'}
                onClick={() => navigate('/')}
                size="lg"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
            </Tooltip>
            <Title order={2}>Token Pool Status</Title>
          </Group>
          <Tooltip label="Refresh status">
            <ActionIcon
              variant="light"
              onClick={fetchStatus}
              loading={loading}
              size="lg"
            >
              <IconRefresh size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {error && (
          <Text c="red" mb="md">
            {error}
          </Text>
        )}

        {loading && !status && (
          <Group justify="center" py="xl">
            <Loader size="lg" />
          </Group>
        )}

        {status && (
          <Stack>
            <Group>
              <Badge size="lg" variant="filled">
                Total Tokens: {status.total_tokens}
              </Badge>
              <Badge 
                size="lg" 
                variant="filled"
                color={status.active_tokens === status.total_tokens ? 'green' : 'yellow'}
              >
                Active Tokens: {status.active_tokens}
              </Badge>
            </Group>

            <Stack gap="md" mt="md">
              {status.tokens.map((token) => (
                <Card 
                  key={token.id} 
                  shadow="sm" 
                  padding="md" 
                  radius="md" 
                  withBorder
                  style={{
                    backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-white)',
                  }}
                >
                  <Group justify="space-between">
                    <Group>
                      <Text fw={500}>Token ID: {token.id}</Text>
                      <Badge
                        variant={token.status === 'available' ? 'light' : 'filled'}
                        color={token.status === 'available' ? 'green' : 'red'}
                      >
                        {token.status}
                      </Badge>
                    </Group>
                    <Badge
                      variant="dot"
                      color={token.error_count > 0 ? 'red' : 'gray'}
                    >
                      Errors: {token.error_count}
                    </Badge>
                  </Group>
                  {token.cooldown_until && (
                    <Text size="sm" c="dimmed" mt="xs">
                      Cooldown until: {new Date(token.cooldown_until).toLocaleString()}
                    </Text>
                  )}
                </Card>
              ))}
            </Stack>
          </Stack>
        )}
      </Paper>
    </Container>
  );
} 