'use client';

import React from 'react';
import { Card, CardBody, CardHeader, Button, Avatar, Badge, Progress } from "@heroui/react";

export default function Dashboard() {
  const stats = [
    { title: "Total Rooms", value: "156", change: "+2", changeType: "positive", icon: "🏠" },
    { title: "Occupied", value: "142", change: "+5", changeType: "positive", icon: "✅" },
    { title: "Available", value: "14", change: "-3", changeType: "negative", icon: "🆓" },
    { title: "Revenue Today", value: "₵45,230", change: "+12%", changeType: "positive", icon: "💰" },
  ];

  const recentBookings = [
    { id: 1, guest: "Kwame Asante", room: "201", checkIn: "Today", status: "checked-in" },
    { id: 2, guest: "Ama Osei", room: "305", checkIn: "Tomorrow", status: "confirmed" },
    { id: 3, guest: "Kofi Mensah", room: "412", checkIn: "Dec 15", status: "pending" },
  ];

  const departmentQuickActions = [
    { title: "Frontdesk Operations", icon: "🏨", color: "bg-ghana-green", href: "/frontdesk", description: "Guest management & bookings" },
    { title: "Housekeeping", icon: "🛏️", color: "bg-ghana-gold", href: "/housekeeping", description: "Room status & maintenance" },
    { title: "Food & Beverage", icon: "🍽️", color: "bg-ghana-red", href: "/f&b", description: "Restaurant & kitchen ops" },
    { title: "Security", icon: "🚨", color: "bg-blue-500", href: "/security", description: "Safety & incident management" },
    { title: "HR & Payroll", icon: "👥", color: "bg-purple-600", href: "/hr", description: "Staff & payroll processing" },
    { title: "Accounting", icon: "🧾", color: "bg-indigo-600", href: "/accounting", description: "Financial management" },
    { title: "Night Audit", icon: "🌙", color: "bg-gray-700", href: "/night-audit", description: "End-of-day processing" },
    { title: "Ghana Compliance", icon: "🇬🇭", color: "bg-ghana-green", href: "/compliance", description: "Regulatory compliance" },
  ];

  const operationalQuickActions = [
    { title: "New Booking", icon: "📅", color: "bg-ghana-green", href: "/bookings/new" },
    { title: "Check In", icon: "🔑", color: "bg-ghana-gold", href: "/checkin" },
    { title: "Room Service", icon: "🍽️", color: "bg-ghana-red", href: "/f&b/orders" },
    { title: "Maintenance", icon: "🔧", color: "bg-blue-500", href: "/maintenance" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="h-10 w-10 bg-ghana-gold rounded-lg flex items-center justify-center mr-3">
                <span className="text-2xl">🏨</span>
              </div>
              <h1 className="text-2xl font-bold text-ghana-black">
                Ghana Hotel Management
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="light"
                className="text-ghana-black hover:bg-ghana-gold/10"
              >
                🔔 Notifications
              </Button>
              <Avatar
                name="Admin User"
                className="bg-ghana-green text-white"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <CardBody className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold text-ghana-black">{stat.value}</p>
                    <div className="flex items-center mt-1">
                      <span className={`text-sm ${
                        stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {stat.change}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">from yesterday</span>
                    </div>
                  </div>
                  <div className="text-3xl">{stat.icon}</div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Department Dashboards */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-ghana-black mb-6">🏢 Department Dashboards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {departmentQuickActions.map((action, index) => (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
                <CardBody className="p-6 text-center">
                  <Button
                    as="a"
                    href={action.href}
                    variant="flat"
                    className={`${action.color} text-white w-full h-20 mb-4`}
                    size="lg"
                  >
                    <span className="text-2xl">{action.icon}</span>
                  </Button>
                  <h3 className="font-semibold text-ghana-black mb-2">{action.title}</h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-lg font-semibold text-ghana-black">🚀 Quick Actions</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                {operationalQuickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="light"
                    className={`w-full justify-start ${action.color} text-white hover:opacity-80 transition-opacity`}
                    size="lg"
                    as="a"
                    href={action.href}
                  >
                    <span className="mr-3">{action.icon}</span>
                    {action.title}
                  </Button>
                ))}
              </CardBody>
            </Card>
          </div>

          {/* Recent Bookings */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-3">
                <h3 className="text-lg font-semibold text-ghana-black">📅 Recent Bookings</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {recentBookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-ghana-gold rounded-full flex items-center justify-center">
                          <span className="text-white text-sm">👤</span>
                        </div>
                        <div>
                          <p className="font-medium text-ghana-black">{booking.guest}</p>
                          <p className="text-sm text-gray-600">Room {booking.room} • {booking.checkIn}</p>
                        </div>
                      </div>
                      <Badge
                        color={booking.status === 'checked-in' ? 'success' : 
                               booking.status === 'confirmed' ? 'primary' : 'warning'}
                        variant="flat"
                      >
                        {booking.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Ghana Compliance Overview */}
        <div className="mt-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold text-ghana-black">🇬🇭 Ghana Compliance Overview</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-ghana-green/10 to-ghana-gold/10 rounded-xl border border-ghana-green/20">
                  <div className="text-2xl mb-2">🧾</div>
                  <p className="font-semibold text-ghana-black">VAT Compliance</p>
                  <p className="text-sm text-gray-600">87% Complete</p>
                  <Progress value={87} className="mt-2" color="success" />
                </div>
                
                <div className="text-center p-4 bg-gradient-to-br from-ghana-red/10 to-ghana-gold/10 rounded-xl border border-ghana-red/20">
                  <div className="text-2xl mb-2">👥</div>
                  <p className="font-semibold text-ghana-black">SSNIT</p>
                  <p className="text-sm text-gray-600">92% Complete</p>
                  <Progress value={92} className="mt-2" color="success" />
                </div>
                
                <div className="text-center p-4 bg-gradient-to-br from-blue-500/10 to-ghana-gold/10 rounded-xl border border-blue-500/20">
                  <div className="text-2xl mb-2">🆔</div>
                  <p className="font-semibold text-ghana-black">Ghana Cards</p>
                  <p className="text-sm text-gray-600">156 Verified</p>
                  <Progress value={95} className="mt-2" color="success" />
                </div>
                
                <div className="text-center p-4 bg-gradient-to-br from-purple-600/10 to-ghana-gold/10 rounded-xl border border-purple-600/20">
                  <div className="text-2xl mb-2">🌙</div>
                  <p className="font-semibold text-ghana-black">Night Audit</p>
                  <p className="text-sm text-gray-600">Last: 2 hours ago</p>
                  <Progress value={100} className="mt-2" color="success" />
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <Button 
                  color="primary" 
                  className="bg-ghana-green text-white"
                  as="a"
                  href="/compliance"
                >
                  View Full Compliance Dashboard
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* System Health & Performance */}
        <div className="mt-8">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <h3 className="text-lg font-semibold text-ghana-black">⚡ System Health & Performance</h3>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-green-500/10 to-ghana-gold/10 rounded-2xl border border-green-500/20">
                  <div className="text-3xl mb-2">🖥️</div>
                  <p className="font-semibold text-ghana-black">System Uptime</p>
                  <p className="text-3xl font-bold text-green-600">99.9%</p>
                  <p className="text-sm text-green-600 mt-1">Last 30 days</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-blue-500/10 to-ghana-gold/10 rounded-2xl border border-blue-500/20">
                  <div className="text-3xl mb-2">📱</div>
                  <p className="font-semibold text-ghana-black">Mobile Money API</p>
                  <p className="text-3xl font-bold text-blue-600">Connected</p>
                  <p className="text-sm text-blue-600 mt-1">MTN & Vodafone</p>
                </div>
                
                <div className="text-center p-6 bg-gradient-to-br from-purple-500/10 to-ghana-gold/10 rounded-2xl border border-purple-500/20">
                  <div className="text-3xl mb-2">🔒</div>
                  <p className="font-semibold text-ghana-black">Security Status</p>
                  <p className="text-3xl font-bold text-purple-600">Protected</p>
                  <p className="text-sm text-purple-600 mt-1">All systems secure</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
