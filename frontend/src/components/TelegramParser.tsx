import { useState } from 'react';
import {
  TextInput,
  Button,
  Paper,
  Title,
  Text,
  Container,
  Stack,
  Card,
  Group,
  Badge,
  ActionIcon,
  Table,
  ScrollArea,
  Pagination,
  Center,
  LoadingOverlay,
} from '@mantine/core';
import { IconBrandTelegram, IconMoonStars, IconSun, IconUsers, IconMessage, IconShield } from '@tabler/icons-react';
import axios from 'axios';

interface GroupInfo {
  group_id: string;
  name: string;
  member_count?: number;
  description?: string;
}

interface MemberInfo {
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_premium?: boolean;
  can_message: boolean;
  is_admin: boolean;
  admin_title?: string;
}

interface TelegramParserProps {
  onToggleTheme: () => void;
  isDark: boolean;
}

interface MembersResponse {
  success: boolean;
  data: MemberInfo[];
  error?: string;
  total_count?: number;
  has_more: boolean;
}

export function TelegramParser({ onToggleTheme, isDark }: TelegramParserProps) {
  const [groupLink, setGroupLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [allMembers, setAllMembers] = useState<MemberInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const MEMBERS_PER_PAGE = 50;

  const getCurrentPageMembers = () => {
    const startIndex = (currentPage - 1) * MEMBERS_PER_PAGE;
    return allMembers.slice(startIndex, startIndex + MEMBERS_PER_PAGE);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAllMembers([]);
    setCurrentPage(1);

    try {
      const cleanLink = groupLink.trim();
      
      const response = await axios.post('http://localhost:8000/api/parse-group', null, {
        params: {
          group_link: cleanLink
        }
      });
      
      if (response.data.success) {
        setGroupInfo(response.data.data);
        await fetchAllMembers(response.data.data.group_id);
      } else {
        setError(response.data.error || 'Failed to parse group');
      }
    } catch (err: any) {
      if (err.response) {
        setError(err.response.data?.error || 'Server error occurred');
      } else if (err.request) {
        setError('Network error. Please check if the server is running.');
      } else {
        setError(err.message || 'An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMembers = async (groupId: string) => {
    setLoadingMembers(true);
    try {
      let allFetchedMembers: MemberInfo[] = [];
      let currentOffset = 0;
      const batchSize = 50;
      let hasMore = true;

      while (hasMore) {
        const response = await axios.get<MembersResponse>(
          `http://localhost:8000/api/group-members/${groupId}`,
          {
            params: {
              offset: currentOffset,
              limit: batchSize
            }
          }
        );

        if (response.data.success && response.data.data.length > 0) {
          allFetchedMembers = [...allFetchedMembers, ...response.data.data];
          currentOffset += batchSize;
          hasMore = response.data.has_more;
        } else {
          hasMore = false;
        }
      }

      setAllMembers(allFetchedMembers);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch members');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const tableContainer = document.querySelector('.mantine-ScrollArea-viewport');
    if (tableContainer) {
      tableContainer.scrollTop = 0;
    }
  };

  const handleMessage = (username: string) => {
    window.open(`https://t.me/${username}`, '_blank');
  };

  return (
    <Container size="lg">
      <Group justify="space-between" mb="xl">
        <Title order={1} style={{ 
          fontFamily: 'Inter, sans-serif',
          fontWeight: 600,
        }}>
          <Group>
            <IconBrandTelegram size={40} />
            Telegram Group Parser
          </Group>
        </Title>
        <ActionIcon
          variant="outline"
          color={isDark ? 'yellow' : 'blue'}
          onClick={onToggleTheme}
          title="Toggle theme"
        >
          {isDark ? (
            <IconSun size={18} />
          ) : (
            <IconMoonStars size={18} />
          )}
        </ActionIcon>
      </Group>

      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <form onSubmit={handleSubmit}>
          <Group align="flex-end" grow>
            <TextInput
              required
              label="Telegram Group Link"
              placeholder="Enter group username (e.g., @groupname) or link (e.g., https://t.me/groupname)"
              value={groupLink}
              onChange={(e) => setGroupLink(e.target.value)}
              leftSection={<IconBrandTelegram size={16} />}
              styles={(theme) => ({
                input: {
                  backgroundColor: isDark 
                    ? theme.colors.dark[6] 
                    : theme.colors.gray[1],
                  color: isDark 
                    ? theme.colors.dark[0]
                    : theme.black,
                  transition: 'all 0.3s ease',
                  transform: 'scale(1)',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  '&:focus': {
                    backgroundColor: isDark 
                      ? theme.colors.dark[6] 
                      : theme.colors.gray[1],
                    transform: 'scale(1.01)',
                    boxShadow: isDark
                      ? `0 0 15px rgba(51, 154, 240, 0.35)`
                      : `0 0 15px rgba(51, 154, 240, 0.25)`,
                    borderColor: isDark
                      ? theme.colors.blue[7]
                      : theme.colors.blue[5],
                  },
                  '&::placeholder': {
                    color: isDark 
                      ? theme.colors.dark[2]
                      : theme.colors.gray[6]
                  }
                },
                label: {
                  color: isDark
                    ? theme.colors.dark[0]
                    : theme.black,
                  transition: 'all 0.3s ease',
                  fontFamily: '"SF Pro Text", sans-serif',
                  fontWeight: 500,
                  '&:focus-within': {
                    transform: 'translateY(-2px)',
                    color: isDark
                      ? theme.colors.blue[4]
                      : theme.colors.blue[7],
                  }
                }
              })}
              style={{ flex: 1 }}
            />
            <Button
              type="submit"
              loading={loading}
              leftSection={<IconUsers size={16} />}
              style={{ 
                flexShrink: 0,
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500
              }}
            >
              Parse Group
            </Button>
          </Group>
        </form>
      </Paper>

      {error && (
        <Paper shadow="sm" p="md" mt="md" radius="md" withBorder>
          <Text c="red">{error}</Text>
        </Paper>
      )}

      {groupInfo && (
        <Card shadow="sm" p="lg" mt="md" radius="md" withBorder>
          <Stack>
            <Group justify="space-between">
              <Title 
                order={3} 
                style={{ 
                  color: isDark ? 'var(--mantine-color-blue-4)' : 'inherit',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600
                }}
              >
                {groupInfo.name}
              </Title>
              <Badge 
                size="lg" 
                variant="filled"
                styles={{
                  root: {
                    fontFamily: '"SF Pro Text", sans-serif',
                    fontWeight: 500
                  }
                }}
              >
                {groupInfo.member_count ?? 'N/A'} members
              </Badge>
            </Group>
            {groupInfo.description && (
              <Text size="sm" c="dimmed">
                {groupInfo.description}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              Group ID: {groupInfo.group_id}
            </Text>

            <div style={{ position: 'relative', minHeight: '400px' }}>
              <LoadingOverlay visible={loadingMembers} />
              {allMembers.length > 0 ? (
                <>
                  <ScrollArea.Autosize mah={600} type="never">
                    <Table 
                      stickyHeader 
                      stickyHeaderOffset={0} 
                      highlightOnHover
                      style={{ tableLayout: 'fixed', width: '100%' }}
                    >
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th 
                            style={{ 
                              width: '60px',
                              backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-white)',
                              color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit',
                              borderBottom: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
                              fontFamily: '"SF Pro Text", sans-serif',
                              fontWeight: 600
                            }}
                          >#</Table.Th>
                          <Table.Th 
                            style={{ 
                              width: '120px',
                              backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-white)',
                              color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit',
                              borderBottom: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
                              fontFamily: '"SF Pro Text", sans-serif',
                              fontWeight: 600
                            }}
                          >User ID</Table.Th>
                          <Table.Th 
                            style={{ 
                              width: '150px',
                              backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-white)',
                              color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit',
                              borderBottom: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
                              fontFamily: '"SF Pro Text", sans-serif',
                              fontWeight: 600
                            }}
                          >Username</Table.Th>
                          <Table.Th 
                            style={{ 
                              width: '200px',
                              backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-white)',
                              color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit',
                              borderBottom: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
                              fontFamily: '"SF Pro Text", sans-serif',
                              fontWeight: 600
                            }}
                          >Name</Table.Th>
                          <Table.Th 
                            style={{ 
                              width: '180px',
                              backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-white)',
                              color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit',
                              borderBottom: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
                              fontFamily: '"SF Pro Text", sans-serif',
                              fontWeight: 600
                            }}
                          >Status</Table.Th>
                          <Table.Th 
                            style={{ 
                              width: '120px',
                              backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-white)',
                              color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit',
                              borderBottom: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
                              fontFamily: '"SF Pro Text", sans-serif',
                              fontWeight: 600
                            }}
                          >Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {getCurrentPageMembers().map((member, index) => (
                          <Table.Tr 
                            key={member.user_id}
                            style={{
                              backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-white)',
                              color: isDark ? 'var(--mantine-color-dark-0)' : 'inherit',
                              '&:hover': {
                                backgroundColor: isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-0)'
                              }
                            }}
                          >
                            <Table.Td style={{ 
                              borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)',
                              width: '60px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 400
                            }}>
                              {(currentPage - 1) * MEMBERS_PER_PAGE + index + 1}
                            </Table.Td>
                            <Table.Td style={{ 
                              borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)',
                              width: '120px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 400
                            }}>
                              {member.user_id}
                            </Table.Td>
                            <Table.Td style={{ 
                              borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)',
                              width: '150px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 400
                            }}>
                              {member.username || 'N/A'}
                            </Table.Td>
                            <Table.Td style={{ 
                              borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)',
                              width: '200px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 400
                            }}>
                              {[member.first_name, member.last_name].filter(Boolean).join(' ') || 'N/A'}
                            </Table.Td>
                            <Table.Td style={{ 
                              borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)',
                              width: '180px',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 600
                            }}>
                              <Group gap="xs">
                                {member.is_admin && (
                                  <Badge 
                                    radius="xl"
                                    size="sm"
                                    variant={isDark ? 'light' : 'filled'}
                                    leftSection={<IconShield size={14} />}
                                    title={member.admin_title || 'Administrator'}
                                    styles={(theme) => ({
                                      root: {
                                        backgroundColor: isDark ? theme.colors.dark[5] : theme.colors.blue[1],
                                        color: isDark ? theme.colors.blue[4] : theme.colors.blue[9],
                                        border: isDark 
                                          ? `1px solid ${theme.colors.blue[9]}`
                                          : '1px solid rgba(51, 154, 240, 0.15)',
                                        boxShadow: isDark 
                                          ? 'none'
                                          : '0 0 1px rgba(51, 154, 240, 0.1)',
                                        fontFamily: '"SF Pro Text", sans-serif',
                                        fontWeight: 500
                                      }
                                    })}
                                  >
                                    Admin
                                  </Badge>
                                )}
                                {member.is_premium && (
                                  <Badge 
                                    radius="xl"
                                    size="sm"
                                    variant={isDark ? 'light' : 'filled'}
                                    styles={(theme) => ({
                                      root: {
                                        backgroundColor: isDark ? theme.colors.dark[5] : theme.colors.yellow[1],
                                        color: isDark ? theme.colors.yellow[4] : theme.colors.yellow[9],
                                        border: isDark 
                                          ? `1px solid ${theme.colors.yellow[9]}`
                                          : '1px solid rgba(245, 159, 0, 0.15)',
                                        boxShadow: isDark 
                                          ? 'none'
                                          : '0 0 1px rgba(245, 159, 0, 0.1)',
                                        fontFamily: '"SF Pro Text", sans-serif',
                                        fontWeight: 500
                                      }
                                    })}
                                  >
                                    Premium
                                  </Badge>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td style={{ borderColor: isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)' }}>
                              {member.username && member.can_message && (
                                <Badge
                                  radius="xl"
                                  size="sm"
                                  variant={isDark ? 'light' : 'filled'}
                                  leftSection={<IconMessage size={14} />}
                                  styles={(theme) => ({
                                    root: {
                                      backgroundColor: isDark ? theme.colors.dark[5] : theme.colors.blue[1],
                                      color: isDark ? theme.colors.blue[4] : theme.colors.blue[9],
                                      border: isDark 
                                        ? `1px solid ${theme.colors.blue[9]}`
                                        : '1px solid rgba(51, 154, 240, 0.15)',
                                      boxShadow: isDark 
                                        ? 'none'
                                        : '0 0 1px rgba(51, 154, 240, 0.1)',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      '&:hover': {
                                        backgroundColor: isDark ? theme.colors.dark[4] : theme.colors.blue[2],
                                        transform: 'translateY(-1px)',
                                        boxShadow: isDark 
                                          ? 'none'
                                          : '0 2px 4px rgba(51, 154, 240, 0.1)'
                                      },
                                      fontFamily: '"SF Pro Text", sans-serif',
                                      fontWeight: 500
                                    }
                                  })}
                                  onClick={() => handleMessage(member.username!)}
                                >
                                  Message
                                </Badge>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea.Autosize>
                  {allMembers.length > MEMBERS_PER_PAGE && (
                    <Center mt="md">
                      <Pagination
                        value={currentPage}
                        onChange={handlePageChange}
                        total={Math.ceil(allMembers.length / MEMBERS_PER_PAGE)}
                        size="md"
                        radius="sm"
                        withEdges
                        getItemProps={(page) => ({
                          component: 'button',
                          'aria-label': page === currentPage ? `Current page, page ${page}` : `Go to page ${page}`,
                        })}
                        styles={(theme) => ({
                          control: {
                            minWidth: '40px',
                            height: '40px',
                            fontSize: theme.fontSizes.sm,
                            transition: 'all 0.2s ease',
                            border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
                            
                            '&[data-active]': {
                              background: '#3498DB',
                              borderColor: '#3498DB',
                              color: '#FFFFFF',
                              boxShadow: isDark ? '0 0 0 1px rgba(52, 152, 219, 0.5)' : 'none',
                            },
                            
                            '&[data-active]:not(:disabled):hover': {
                              background: '#2980B9',
                            },
                            
                            '&:not([data-active])': {
                              color: isDark ? '#E5E7EB' : theme.colors.gray[7],
                              backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                            },
                            
                            '&:not([data-active]):not(:disabled):hover': {
                              backgroundColor: isDark ? theme.colors.dark[5] : theme.colors.gray[0],
                            },
                            
                            '&:disabled': {
                              opacity: 0.5,
                              cursor: 'not-allowed',
                            },
                            
                            '@media (max-width: 600px)': {
                              minWidth: '36px',
                              height: '36px',
                              padding: '0 4px',
                            }
                          }
                        })}
                      />
                    </Center>
                  )}
                </>
              ) : null}
            </div>
          </Stack>
        </Card>
      )}
    </Container>
  );
} 