import { useState, useEffect } from 'react';
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
  Tooltip,
  Progress,
  Modal,
  Code,
  Notification,
} from '@mantine/core';
import { IconBrandTelegram, IconMoonStars, IconSun, IconUsers, IconMessage, IconShield, IconDashboard, IconLogin, IconUserPlus, IconLogout, IconUser, IconCopy, IconCheck, IconX, IconInfoCircle, IconFileSpreadsheet, IconDownload } from '@tabler/icons-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { notifications } from '@mantine/notifications';

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

interface UserInfo {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_superuser: boolean;
  is_verified: boolean;
}

const sanitizeFilename = (filename: string): string => {
  // Remove special characters but keep basic punctuation and spaces
  return filename
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[-\s]+/g, '_') // Replace spaces and hyphens with underscore
    .trim() // Remove leading/trailing spaces
    || 'group'; // Fallback if empty
};

const downloadCSV = (members: MemberInfo[], groupName: string) => {
  const headers = ['User ID', 'Username', 'First Name', 'Last Name', 'Is Premium', 'Is Admin', 'Admin Title', 'Can Message'];
  const csvContent = [
    headers.join(','),
    ...members.map(member => [
      member.user_id,
      member.username || '',
      (member.first_name || '').replace(/,/g, ' '),
      (member.last_name || '').replace(/,/g, ' '),
      member.is_premium ? 'Yes' : 'No',
      member.is_admin ? 'Yes' : 'No',
      (member.admin_title || '').replace(/,/g, ' '),
      member.can_message ? 'Yes' : 'No'
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeFilename = sanitizeFilename(groupName);
  link.setAttribute('download', `${safeFilename}-members-${currentDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadExcel = async (members: MemberInfo[], groupName: string) => {
  try {
    const response = await axios.post(
      'http://localhost:8000/api/export-excel',
      { members, group_name: groupName },
      { 
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeFilename = sanitizeFilename(groupName);
    link.setAttribute('download', `${safeFilename}-members-${currentDate}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    notifications.show({
      title: 'Export Failed',
      message: 'Failed to export data to Excel. Please try again.',
      color: 'red'
    });
  }
};

export function TelegramParser({ onToggleTheme, isDark }: TelegramParserProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [groupLink, setGroupLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [allMembers, setAllMembers] = useState<MemberInfo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [loginModalOpened, setLoginModalOpened] = useState(false);
  const [registerModalOpened, setRegisterModalOpened] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null);
  const [verificationModalOpened, setVerificationModalOpened] = useState(false);
  const [verificationLink, setVerificationLink] = useState('');
  const [verificationStatusModalOpened, setVerificationStatusModalOpened] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'success' | 'already' | 'expired' | null>(null);
  const MEMBERS_PER_PAGE = 50;

  useEffect(() => {
    // Check if user is logged in on component mount
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserInfo(token);
    }
  }, []);

  useEffect(() => {
    const verificationStatus = searchParams.get('verified');
    if (verificationStatus) {
      // Remove the query parameter
      navigate('/', { replace: true });
      
      // Show verification modal based on status
      if (verificationStatus === 'success' || verificationStatus === 'already' || verificationStatus === 'expired') {
        setVerificationStatus(verificationStatus);
        setVerificationStatusModalOpened(true);
      }
    }
  }, [searchParams, navigate]);

  const fetchUserInfo = async (token: string) => {
    try {
      const response = await axios.get('http://localhost:8000/users/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setCurrentUser(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching user info:', err);
      localStorage.removeItem('token');
      setCurrentUser(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

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
      const token = localStorage.getItem('token');
      
      const response = await axios.post('http://localhost:8000/api/parse-group', null, {
        params: {
          group_link: cleanLink
        },
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : undefined
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
    setFetchProgress(0);
    let retryCount = 0;
    const maxRetries = 3;

    const attemptFetch = async () => {
      try {
        let allFetchedMembers: MemberInfo[] = [];
        let currentOffset = 0;
        const batchSize = 50;
        let hasMore = true;

        // Get total count first
        const initialResponse = await axios.get<MembersResponse>(
          `http://localhost:8000/api/group-members/${groupId}`,
          {
            params: {
              offset: 0,
              limit: 1
            }
          }
        );

        if (!initialResponse.data.success) {
          throw new Error(initialResponse.data.error || 'Failed to get member count');
        }

        const totalMembers = initialResponse.data.total_count || 0;

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

          if (!response.data.success) {
            throw new Error(response.data.error || 'Failed to fetch members');
          }

          if (response.data.data.length > 0) {
            allFetchedMembers = [...allFetchedMembers, ...response.data.data];
            currentOffset += batchSize;
            hasMore = response.data.has_more;
            
            // Update progress
            const progress = Math.min(Math.round((allFetchedMembers.length / totalMembers) * 100), 100);
            setFetchProgress(progress);
          } else {
            hasMore = false;
            setFetchProgress(100);
          }
        }

        setAllMembers(allFetchedMembers);
        return true;
      } catch (err: any) {
        if (retryCount < maxRetries) {
          retryCount++;
          setError(`Retrying... Attempt ${retryCount} of ${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          return attemptFetch();
        }
        
        const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch members';
        if (errorMessage.includes('Could not find the input entity')) {
          setError('Unable to access the group. Please make sure the bot is a member of the group and has admin rights.');
        } else {
          setError(`${errorMessage}. Please try again later.`);
        }
        return false;
      }
    };

    try {
      const success = await attemptFetch();
      if (!success) {
        setAllMembers([]);
      }
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

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:8000/token', 
        new URLSearchParams({
          'username': username,
          'password': password,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      const token = response.data.access_token;
      localStorage.setItem('token', token);
      await fetchUserInfo(token);
      setLoginModalOpened(false);
      setUsername('');
      setPassword('');
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed');
    }
  };

  // Add axios interceptor to handle authentication
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, []);

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
        <Group>
          {currentUser ? (
            <>
              <Paper p="xs" radius="md" withBorder style={{
                backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
              }}>
                <Group gap="xs">
                  <IconUser size={18} />
                  <Text size="sm" fw={500}>
                    {currentUser.username}
                  </Text>
                  <Badge size="sm" variant="light" color="green">
                    Logged In
                  </Badge>
                  {currentUser.is_verified ? (
                    <Badge size="sm" variant="light" color="blue">
                      Verified
                    </Badge>
                  ) : (
                    <Badge size="sm" variant="light" color="yellow">
                      Unverified
                    </Badge>
                  )}
                </Group>
              </Paper>
              <Button
                variant="outline"
                leftSection={<IconLogout size={18} />}
                onClick={handleLogout}
                color="red"
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                leftSection={<IconUserPlus size={18} />}
                onClick={() => setRegisterModalOpened(true)}
                color={isDark ? 'blue' : 'blue'}
              >
                Register
              </Button>
              <Button
                variant="outline"
                leftSection={<IconLogin size={18} />}
                onClick={() => setLoginModalOpened(true)}
                color={isDark ? 'blue' : 'blue'}
              >
                Login
              </Button>
            </>
          )}
          <Tooltip label="View token pool status">
            <ActionIcon
              variant="outline"
              color={isDark ? 'blue' : 'blue'}
              onClick={() => navigate('/token-status')}
              title="Token pool status"
            >
              <IconDashboard size={18} />
            </ActionIcon>
          </Tooltip>
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
      </Group>

      {/* Login Modal */}
      <Modal
        opened={loginModalOpened}
        onClose={() => {
          setLoginModalOpened(false);
          setUsername('');
          setPassword('');
          setError(null);
        }}
        title={
          <Text 
            size="lg" 
            fw={600} 
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: isDark ? 'var(--mantine-color-white)' : 'var(--mantine-color-dark-9)'
            }}
          >
            Login
          </Text>
        }
        centered
        size="sm"
        styles={{
          header: {
            backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
          },
          content: {
            backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-white)',
          },
          close: {
            width: '32px',
            height: '32px',
            backgroundColor: isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-1)',
            border: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
            borderRadius: '4px',
            color: isDark ? 'var(--mantine-color-gray-4)' : 'var(--mantine-color-dark-4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: isDark ? 'var(--mantine-color-blue-8)' : 'var(--mantine-color-blue-1)',
              color: isDark ? 'var(--mantine-color-white)' : 'var(--mantine-color-blue-6)',
              border: `2px solid ${isDark ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-blue-5)'}`,
              transform: 'scale(1.15)',
            }
          }
        }}
      >
        <Stack>
          <TextInput
            required
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            styles={(theme) => ({
              input: {
                backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                color: isDark ? theme.colors.dark[0] : theme.black,
                borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[4],
              },
              label: {
                color: isDark ? theme.colors.dark[0] : theme.black,
              }
            })}
          />
          <TextInput
            required
            type="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleLogin();
              }
            }}
            styles={(theme) => ({
              input: {
                backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                color: isDark ? theme.colors.dark[0] : theme.black,
                borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[4],
              },
              label: {
                color: isDark ? theme.colors.dark[0] : theme.black,
              }
            })}
          />
          {error && (
            <Text color="red" size="sm">
              {error}
            </Text>
          )}
          <Button 
            onClick={handleLogin}
            variant="filled"
            style={{
              backgroundColor: isDark ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-blue-6)',
            }}
          >
            Login
          </Button>
        </Stack>
      </Modal>

      {/* Register Modal */}
      <Modal
        opened={registerModalOpened}
        onClose={() => {
          setRegisterModalOpened(false);
          setEmail('');
          setUsername('');
          setPassword('');
          setError(null);
        }}
        title={
          <Text 
            size="lg" 
            fw={600} 
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: isDark ? 'var(--mantine-color-white)' : 'var(--mantine-color-dark-9)'
            }}
          >
            Register
          </Text>
        }
        centered
        size="sm"
        styles={{
          header: {
            backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
          },
          content: {
            backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-white)',
          },
          close: {
            width: '32px',
            height: '32px',
            backgroundColor: isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-1)',
            border: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
            borderRadius: '4px',
            color: isDark ? 'var(--mantine-color-gray-4)' : 'var(--mantine-color-dark-4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: isDark ? 'var(--mantine-color-blue-8)' : 'var(--mantine-color-blue-1)',
              color: isDark ? 'var(--mantine-color-white)' : 'var(--mantine-color-blue-6)',
              border: `2px solid ${isDark ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-blue-5)'}`,
              transform: 'scale(1.15)',
            }
          }
        }}
      >
        <Stack>
          <TextInput
            required
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            styles={(theme) => ({
              input: {
                backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                color: isDark ? theme.colors.dark[0] : theme.black,
                borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[4],
              },
              label: {
                color: isDark ? theme.colors.dark[0] : theme.black,
              }
            })}
          />
          <TextInput
            required
            label="Username"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            styles={(theme) => ({
              input: {
                backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                color: isDark ? theme.colors.dark[0] : theme.black,
                borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[4],
              },
              label: {
                color: isDark ? theme.colors.dark[0] : theme.black,
              }
            })}
          />
          <TextInput
            required
            type="password"
            label="Password"
            placeholder="Choose a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            styles={(theme) => ({
              input: {
                backgroundColor: isDark ? theme.colors.dark[6] : theme.white,
                color: isDark ? theme.colors.dark[0] : theme.black,
                borderColor: isDark ? theme.colors.dark[4] : theme.colors.gray[4],
              },
              label: {
                color: isDark ? theme.colors.dark[0] : theme.black,
              }
            })}
          />
          {error && (
            <Text color="red" size="sm">
              {error}
            </Text>
          )}
          <Button
            onClick={async () => {
              try {
                const response = await axios.post('http://localhost:8000/register', {
                  email,
                  username,
                  password,
                });
                
                // Show verification instructions
                const verificationToken = response.data.verification_token;
                const verificationUrl = `http://localhost:8000/verify/${verificationToken}`;
                
                setRegisterModalOpened(false);
                setEmail('');
                setUsername('');
                setPassword('');
                setError(null);
                
                // Show verification modal instead of alert
                setVerificationLink(verificationUrl);
                setVerificationModalOpened(true);
              } catch (err: any) {
                setError(err.response?.data?.detail || 'Registration failed');
              }
            }}
            variant="filled"
            style={{
              backgroundColor: isDark ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-blue-6)',
            }}
          >
            Register
          </Button>
        </Stack>
      </Modal>

      {/* Verification Modal */}
      <Modal
        opened={verificationModalOpened}
        onClose={() => {
          setVerificationModalOpened(false);
          setLoginModalOpened(true);
        }}
        title={
          <Text 
            size="lg" 
            fw={600} 
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: isDark ? 'var(--mantine-color-white)' : 'var(--mantine-color-dark-9)'
            }}
          >
            Registration Successful!
          </Text>
        }
        centered
        size="lg"
        styles={{
          header: {
            backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
          },
          content: {
            backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-white)',
          },
          close: {
            width: '32px',
            height: '32px',
            backgroundColor: isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-1)',
            border: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
            borderRadius: '4px',
            color: isDark ? 'var(--mantine-color-gray-4)' : 'var(--mantine-color-dark-4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: isDark ? 'var(--mantine-color-blue-8)' : 'var(--mantine-color-blue-1)',
              color: isDark ? 'var(--mantine-color-white)' : 'var(--mantine-color-blue-6)',
              border: `2px solid ${isDark ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-blue-5)'}`,
              transform: 'scale(1.15)',
            }
          }
        }}
      >
        <Stack gap="md">
          <Text>Please verify your email by visiting the following link:</Text>
          <Paper 
            p="md" 
            withBorder 
            style={{
              backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
              position: 'relative'
            }}
          >
            <Group justify="space-between" align="center">
              <Code style={{ 
                flex: 1,
                wordBreak: 'break-all',
                backgroundColor: isDark ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-gray-1)',
                padding: '10px',
                borderRadius: '4px',
                color: isDark ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-blue-7)'
              }}>
                {verificationLink}
              </Code>
              <ActionIcon
                variant="light"
                color="blue"
                onClick={() => {
                  navigator.clipboard.writeText(verificationLink);
                }}
                title="Copy link"
                style={{
                  marginLeft: '8px'
                }}
              >
                <IconCopy size={18} />
              </ActionIcon>
            </Group>
          </Paper>
          <Text size="sm" c="dimmed">
            In a real application, this link would be sent to your email address.
          </Text>
          <Button
            onClick={() => {
              setVerificationModalOpened(false);
              setLoginModalOpened(true);
            }}
            variant="light"
            color="blue"
            fullWidth
          >
            Proceed to Login
          </Button>
        </Stack>
      </Modal>

      {/* Verification Status Modal */}
      <Modal
        opened={verificationStatusModalOpened}
        onClose={() => {
          setVerificationStatusModalOpened(false);
          setVerificationStatus(null);
          // Open login modal if verification was successful
          if (verificationStatus === 'success') {
            setLoginModalOpened(true);
          }
        }}
        title={
          <Text 
            size="lg" 
            fw={600} 
            style={{ 
              fontFamily: 'Inter, sans-serif',
              color: isDark ? 'var(--mantine-color-white)' : 'var(--mantine-color-dark-9)'
            }}
          >
            {verificationStatus === 'success' && 'Email Verified Successfully!'}
            {verificationStatus === 'already' && 'Email Already Verified'}
            {verificationStatus === 'expired' && 'Verification Link Expired'}
          </Text>
        }
        centered
        size="md"
        styles={{
          header: {
            backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
          },
          content: {
            backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-white)',
          },
          close: {
            width: '32px',
            height: '32px',
            backgroundColor: isDark ? 'var(--mantine-color-dark-5)' : 'var(--mantine-color-gray-1)',
            border: `2px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
            borderRadius: '4px',
            color: isDark ? 'var(--mantine-color-gray-4)' : 'var(--mantine-color-dark-4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: isDark ? 'var(--mantine-color-blue-8)' : 'var(--mantine-color-blue-1)',
              color: isDark ? 'var(--mantine-color-white)' : 'var(--mantine-color-blue-6)',
              border: `2px solid ${isDark ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-blue-5)'}`,
              transform: 'scale(1.15)',
            }
          }
        }}
      >
        <Stack gap="md">
          <Paper 
            p="md" 
            withBorder 
            style={{
              backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-0)',
              textAlign: 'center'
            }}
          >
            {verificationStatus === 'success' && (
              <>
                <IconCheck size={48} color="green" style={{ marginBottom: '1rem' }} />
                <Text size="md" style={{ color: isDark ? 'var(--mantine-color-white)' : 'inherit' }}>
                  Your email has been successfully verified. You can now log in to your account.
                </Text>
              </>
            )}
            {verificationStatus === 'already' && (
              <>
                <IconInfoCircle size={48} color="blue" style={{ marginBottom: '1rem' }} />
                <Text size="md" style={{ color: isDark ? 'var(--mantine-color-white)' : 'inherit' }}>
                  Your email was already verified. You can proceed to log in.
                </Text>
              </>
            )}
            {verificationStatus === 'expired' && (
              <>
                <IconX size={48} color="red" style={{ marginBottom: '1rem' }} />
                <Text size="md" style={{ color: isDark ? 'var(--mantine-color-white)' : 'inherit' }}>
                  The verification link has expired. Please register again to receive a new verification link.
                </Text>
              </>
            )}
          </Paper>
          <Button
            onClick={() => {
              setVerificationStatusModalOpened(false);
              if (verificationStatus === 'success' || verificationStatus === 'already') {
                setLoginModalOpened(true);
              } else if (verificationStatus === 'expired') {
                setRegisterModalOpened(true);
              }
            }}
            variant="light"
            color={verificationStatus === 'expired' ? 'red' : 'blue'}
            fullWidth
          >
            {verificationStatus === 'expired' ? 'Register Again' : 'Proceed to Login'}
          </Button>
        </Stack>
      </Modal>

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
              <Group gap="md">
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
              {currentUser && allMembers.length > 0 && (
                <Group>
                  <Button
                    variant="outline"
                    leftSection={<IconDownload size={16} />}
                    onClick={() => downloadCSV(allMembers, groupInfo.name)}
                    color="blue"
                    size="sm"
                    styles={(theme) => ({
                      root: {
                        border: `1px solid ${isDark ? theme.colors.blue[9] : theme.colors.blue[4]}`,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: isDark ? theme.colors.blue[9] : theme.colors.blue[1],
                          transform: 'translateY(-1px)',
                          boxShadow: isDark 
                            ? '0 4px 8px rgba(37, 99, 235, 0.3)'
                            : '0 4px 8px rgba(37, 99, 235, 0.15)',
                        }
                      }
                    })}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    leftSection={<IconFileSpreadsheet size={16} />}
                    onClick={() => downloadExcel(allMembers, groupInfo.name)}
                    color="green"
                    size="sm"
                    styles={(theme) => ({
                      root: {
                        border: `1px solid ${isDark ? theme.colors.green[9] : theme.colors.green[4]}`,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: isDark ? theme.colors.green[9] : theme.colors.green[1],
                          transform: 'translateY(-1px)',
                          boxShadow: isDark 
                            ? '0 4px 8px rgba(34, 197, 94, 0.3)'
                            : '0 4px 8px rgba(34, 197, 94, 0.15)',
                        }
                      }
                    })}
                  >
                    Export Excel
                  </Button>
                </Group>
              )}
            </Group>
            {groupInfo.description && (
              <Text size="sm" c="dimmed">
                {groupInfo.description}
              </Text>
            )}
            <Text size="xs" c="dimmed">
              Group ID: {groupInfo.group_id}
            </Text>

            <div style={{ 
              position: 'relative', 
              minHeight: '400px',
              backgroundColor: isDark ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-white)',
              borderRadius: 'var(--mantine-radius-md)',
              border: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
            }}>
              {loadingMembers && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '80%',
                  maxWidth: '400px',
                  textAlign: 'center',
                  zIndex: 1000
                }}>
                  <Text 
                    size="lg" 
                    fw={500} 
                    mb="md"
                    style={{
                      color: isDark ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-blue-7)',
                      fontFamily: '"SF Pro Text", sans-serif',
                    }}
                  >
                    Fetching group members... {fetchProgress}%
                  </Text>
                  <Progress 
                    value={fetchProgress}
                    size="lg"
                    radius="xl"
                    striped
                    animated
                    color={fetchProgress === 100 ? 'green' : 'blue'}
                    style={{
                      backgroundColor: isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)',
                    }}
                  />
                </div>
              )}
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