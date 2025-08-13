import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Target, Users } from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();

  const stats = [
    {
      title: 'Leave Balance',
      value: '12 days',
      description: 'Annual leave remaining',
      icon: Calendar,
      color: 'bg-blue-500'
    },
    {
      title: 'Days Present',
      value: '22/23',
      description: 'This month',
      icon: Clock,
      color: 'bg-green-500'
    },
    {
      title: 'Active Goals',
      value: '3',
      description: 'Performance goals',
      icon: Target,
      color: 'bg-purple-500'
    },
    {
      title: 'Team Size',
      value: '8',
      description: 'Direct reports',
      icon: Users,
      color: 'bg-orange-500'
    }
  ];

  const upcomingHolidays = [
    { name: 'Independence Day', date: '2025-08-15' },
    { name: 'Gandhi Jayanti', date: '2025-10-02' },
    { name: 'Diwali', date: '2025-11-01' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.full_name}!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <IconComponent className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-gray-600">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Project Entry</CardTitle>
            <CardDescription>Log your daily project work</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Today's Project</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project name..."
                />
              </div>
              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                Log Project
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Holidays</CardTitle>
            <CardDescription>Public holidays this year</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingHolidays.map((holiday) => (
                <div key={holiday.name} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{holiday.name}</span>
                  <Badge variant="outline">{holiday.date}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}