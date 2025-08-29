import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../lib/AuthContext';
import { apiService } from '../services/apiService';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  picture?: string;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  total_evaluations: number;
  evaluations_today: number;
  users_by_role: Record<string, number>;
}

export default function Admin() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Check if user is admin
  if (!authUser || authUser.role !== 'admin') {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            You don't have permission to access this page. Admin role required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersResponse, statsResponse] = await Promise.all([
        apiService.getAdminUsers(),
        apiService.getAdminStats()
      ]);

      setUsers(usersResponse);
      setStats(statsResponse);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId: number, action: string, newRole?: string) => {
    try {
      // Confirmation for sensitive actions
      const isRoleChange = action === 'change_role';
      const isDeactivate = action === 'toggle_status';
      if (isRoleChange) {
        const confirmMsg = newRole === 'admin' ?
          'Make this user an admin? They will get full access.' :
          'Remove admin rights from this user? They will lose admin access.';
        if (!window.confirm(confirmMsg)) return;
      }
      if (isDeactivate) {
        if (!window.confirm('Are you sure you want to toggle this user\'s active status?')) return;
      }

      setActionLoading(`${action}-${userId}`);

      const payload: any = {
        user_id: userId,
        action: action
      };

      if (newRole) {
        payload.new_role = newRole;
      }

      await apiService.manageUser(userId, action, newRole);

      // Reload users data
      await loadAdminData();
    } catch (err: any) {
      setError(err.message || `Failed to ${action} user`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getRoleBadgeVariant = (role: string) => {
    return role === 'admin' ? 'destructive' : 'secondary';
  };

  const getStatusBadgeVariant = (isActive: boolean) => {
    return isActive ? 'default' : 'outline';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-lg">Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  // Filtered users by search
  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage users and view system statistics</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_users}</div>
              <p className="text-xs text-muted-foreground">
                {stats.active_users} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_evaluations}</div>
              <p className="text-xs text-muted-foreground">
                {stats.evaluations_today} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.users_by_role.admin || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Regular Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.users_by_role.user || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription>Manage user accounts and permissions</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, email, or role"
                    className="w-64 px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map((userItem) => (
                  <div key={userItem.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      {userItem.picture && (
                        <img
                          src={userItem.picture}
                          alt={userItem.name}
                          className="w-10 h-10 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium">{userItem.name}</div>
                        <div className="text-sm text-muted-foreground">{userItem.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Created: {formatDate(userItem.created_at)}
                          {userItem.last_login && (
                            <span> • Last login: {formatDate(userItem.last_login)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge variant={getRoleBadgeVariant(userItem.role)}>
                        {userItem.role}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(userItem.is_active)}>
                        {userItem.is_active ? 'Active' : 'Inactive'}
                      </Badge>

                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUserAction(userItem.id, 'toggle_status')}
                          disabled={actionLoading === `toggle_status-${userItem.id}`}
                        >
                          {userItem.is_active ? 'Deactivate' : 'Activate'}
                        </Button>

                        {userItem.role === 'user' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserAction(userItem.id, 'change_role', 'admin')}
                            disabled={actionLoading === `change_role-${userItem.id}`}
                          >
                            Make Admin
                          </Button>
                        )}

                        {/* Allow removing admin role for other admins but not yourself */}
                        {userItem.role === 'admin' && userItem.email !== authUser.email && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUserAction(userItem.id, 'change_role', 'user')}
                            disabled={actionLoading === `change_role-${userItem.id}`}
                          >
                            Remove Admin
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredUsers.length === 0 && (
                  <div className="text-sm text-muted-foreground py-6 text-center">No users match your search.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure system-wide settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Database Status</h3>
                  <p className="text-sm text-muted-foreground">
                    System is operational with {stats?.total_users} users and {stats?.total_evaluations} evaluations.
                  </p>
                </div>

                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Model Status</h3>
                  <p className="text-sm text-muted-foreground">
                    AI evaluation model is loaded and ready for processing.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
