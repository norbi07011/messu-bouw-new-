import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppointments } from '@/hooks/useElectronDB';
import { useClients } from '@/hooks/useElectronDB';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, PencilSimple, Trash, Calendar, MagnifyingGlass, Check, X, Clock, MapPin, Bell, CaretLeft, CaretRight, List } from '@phosphor-icons/react';
import { Appointment } from '@/types';
import { toast } from 'sonner';

export default function Appointments() {
  const { t } = useTranslation();
  const { appointments, createAppointment, updateAppointment, deleteAppointment, loading } = useAppointments();
  const { clients } = useClients();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Debug: Monitor dialog state
  useEffect(() => {
    console.log('🚪 Dialog state changed:', isDialogOpen);
  }, [isDialogOpen]);

  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    date: '',
    time: '',
    duration: 60,
    location: '',
    description: '',
    reminder_minutes: 30,
    status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled',
  });

  // Powiadomienia - sprawdzaj co minutę
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      appointments.forEach(appointment => {
        if (appointment.status !== 'scheduled') return;
        if (appointment.reminder_minutes === 0) return;

        const appointmentDate = new Date(`${appointment.date}T${appointment.time}`);
        const reminderTime = new Date(appointmentDate.getTime() - appointment.reminder_minutes * 60000);
        
        // Sprawdź czy czas powiadomienia minął w ostatniej minucie
        const diff = now.getTime() - reminderTime.getTime();
        if (diff > 0 && diff < 60000) {
          const clientName = clients.find(c => c.id === appointment.client_id)?.name || 'Klient';
          toast.info(`📅 Przypomnienie o spotkaniu`, {
            description: `${appointment.title} z ${clientName} za ${appointment.reminder_minutes} minut`,
            duration: 10000,
          });
          
          // Browser notification jeśli dostępne
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Przypomnienie o spotkaniu', {
              body: `${appointment.title} z ${clientName} za ${appointment.reminder_minutes} minut`,
              icon: '/messu-bouw-logo.jpg'
            });
          }
        }
      });
    };

    // Poproś o pozwolenie na powiadomienia
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Sprawdzaj co minutę
    const interval = setInterval(checkReminders, 60000);
    checkReminders(); // Uruchom od razu

    return () => clearInterval(interval);
  }, [appointments, clients]);

  // Filtrowane i posortowane spotkania
  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    // Filtr po statusie
    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    // Wyszukiwanie
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(term) ||
        a.location?.toLowerCase().includes(term) ||
        a.description?.toLowerCase().includes(term)
      );
    }

    // Sortuj po dacie i czasie (najnowsze najpierw)
    return filtered.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}`);
      const dateB = new Date(`${b.date}T${b.time}`);
      return dateB.getTime() - dateA.getTime();
    });
  }, [appointments, statusFilter, searchTerm]);

  const handleOpenDialog = (appointment?: Appointment, prefilledDate?: string) => {
    console.log('🔔 handleOpenDialog called', { appointment, prefilledDate });
    if (appointment) {
      console.log('📝 Editing appointment');
      setEditingAppointment(appointment);
      setFormData({
        title: appointment.title,
        client_id: appointment.client_id || '',
        date: appointment.date,
        time: appointment.time,
        duration: appointment.duration,
        location: appointment.location || '',
        description: appointment.description || '',
        reminder_minutes: appointment.reminder_minutes,
        status: appointment.status,
      });
    } else {
      console.log('➕ Creating new appointment');
      setEditingAppointment(null);
      const today = new Date().toISOString().split('T')[0];
      const newFormData = {
        title: '',
        client_id: '',
        date: prefilledDate || today,
        time: '09:00',
        duration: 60,
        location: '',
        description: '',
        reminder_minutes: 30,
        status: 'scheduled' as 'scheduled' | 'completed' | 'cancelled',
      };
      console.log('📋 Form data:', newFormData);
      setFormData(newFormData);
    }
    console.log('🚪 Opening dialog...');
    setIsDialogOpen(true);
    console.log('🚪 Dialog should be open now');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.date || !formData.time) {
      toast.error('Wypełnij wszystkie wymagane pola');
      return;
    }

    try {
      if (editingAppointment) {
        await updateAppointment(editingAppointment.id, formData);
        toast.success('✅ Spotkanie zaktualizowane');
      } else {
        await createAppointment(formData);
        toast.success('✅ Spotkanie dodane');
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving appointment:', error);
      toast.error('❌ Błąd podczas zapisywania');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno usunąć to spotkanie?')) return;
    
    try {
      await deleteAppointment(id);
      toast.success('✅ Spotkanie usunięte');
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast.error('❌ Błąd podczas usuwania');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default" className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-all">Zaplanowane</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md hover:shadow-lg transition-all">Zakończone</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="bg-gradient-to-r from-red-500 to-rose-600 shadow-md hover:shadow-lg transition-all">Anulowane</Badge>;
      default:
        return null;
    }
  };

  const formatDateTime = (date: string, time: string) => {
    const d = new Date(`${date}T${time}`);
    return new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d);
  };

  // Funkcje kalendarza
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getAppointmentsForDate = (date: string) => {
    return appointments.filter(apt => apt.date === date);
  };

  const handleDateClick = (date: string) => {
    handleOpenDialog(undefined, date);
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days: React.ReactElement[] = [];
    const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    const dayNames = ['Nie', 'Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob'];

    // Puste komórki przed pierwszym dniem miesiąca
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-32 bg-gray-50 dark:bg-gray-900"></div>);
    }

    // Dni miesiąca
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAppointments = getAppointmentsForDate(dateStr);
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      
      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(dateStr)}
          className={`group relative h-36 border-2 p-3 cursor-pointer transition-all duration-300 overflow-hidden ${
            isToday 
              ? 'bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-900/40 dark:to-sky-900/40 border-blue-400 dark:border-blue-500 shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30 ring-2 ring-blue-400 dark:ring-blue-500' 
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-xl hover:shadow-blue-100/50 dark:hover:shadow-blue-900/20 hover:-translate-y-1'
          }`}
        >
          {/* Dzień miesiąca */}
          <div className={`text-lg font-bold mb-2 transition-colors ${
            isToday 
              ? 'text-blue-600 dark:text-blue-300' 
              : 'text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400'
          }`}>
            {day}
          </div>
          
          {/* Spotkania */}
          <div className="space-y-1.5 overflow-y-auto max-h-20 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {dayAppointments.map((apt) => (
              <div
                key={apt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDialog(apt);
                }}
                className={`text-xs px-2 py-1.5 rounded-lg truncate font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 ${
                  apt.status === 'scheduled' 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700' 
                    : apt.status === 'completed' 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700' 
                    : 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700'
                }`}
                title={`${apt.time} - ${apt.title}`}
              >
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span className="font-semibold">{apt.time}</span>
                  <span className="truncate">{apt.title}</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-sky-500/5 dark:group-hover:from-blue-500/10 dark:group-hover:to-sky-500/10 transition-all duration-300 pointer-events-none"></div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Nawigacja kalendarza */}
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-sky-50 dark:from-gray-800 dark:to-gray-900 p-4 rounded-xl shadow-sm">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-sky-600 dark:from-blue-400 dark:to-sky-400 bg-clip-text text-transparent">
            {monthNames[month]} {year}
          </h2>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToToday}
              className="bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-semibold shadow-sm hover:shadow-md transition-all"
            >
              Dzisiaj
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={previousMonth}
              className="bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:scale-110 transition-all shadow-sm"
            >
              <CaretLeft className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={nextMonth}
              className="bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:scale-110 transition-all shadow-sm"
            >
              <CaretRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Nagłówki dni tygodnia */}
        <div className="grid grid-cols-7 gap-2">
          {dayNames.map(name => (
            <div 
              key={name} 
              className="text-center font-bold text-sm text-gray-600 dark:text-gray-400 p-3 bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-sm"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Dni */}
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>

        {/* Legenda */}
        <div className="flex gap-6 text-sm bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 shadow-md"></div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Zaplanowane</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 shadow-md"></div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Ukończone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-r from-red-500 to-rose-600 shadow-md"></div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Anulowane</span>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Calendar className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p>Ładowanie spotkań...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="shadow-2xl border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                  <Calendar className="w-7 h-7" />
                </div>
                Kalendarz Spotkań
              </CardTitle>
              <CardDescription className="text-blue-100 mt-2 text-base">
                Zarządzaj spotkaniami z klientami i otrzymuj powiadomienia
              </CardDescription>
            </div>
            <div className="flex gap-3">
              <div className="flex bg-white/10 backdrop-blur-md rounded-xl p-1.5 shadow-lg">
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className={viewMode === 'calendar' 
                    ? 'bg-white text-blue-600 hover:bg-white/90 shadow-md' 
                    : 'text-white hover:bg-white/20'}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Kalendarz
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' 
                    ? 'bg-white text-blue-600 hover:bg-white/90 shadow-md' 
                    : 'text-white hover:bg-white/20'}
                >
                  <List className="w-4 h-4 mr-2" />
                  Lista
                </Button>
              </div>
              <Button 
                onClick={() => handleOpenDialog()}
                className="bg-white text-blue-600 hover:bg-white/90 shadow-lg hover:shadow-xl transition-all hover:scale-105 font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nowe spotkanie
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {viewMode === 'calendar' ? (
            renderCalendar()
          ) : (
            <>
              {/* Filtry */}
              <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
                <Input
                  placeholder="Szukaj spotkań..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-2 border-gray-200 dark:border-gray-700 focus:border-blue-400 dark:focus:border-blue-500 rounded-xl shadow-sm hover:shadow-md transition-all"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px] border-2 border-gray-200 dark:border-gray-700 focus:border-blue-400 rounded-xl shadow-sm hover:shadow-md transition-all">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-xl">
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="scheduled">Zaplanowane</SelectItem>
                <SelectItem value="completed">Zakończone</SelectItem>
                <SelectItem value="cancelled">Anulowane</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela spotkań */}
          <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden shadow-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-800">
                  <TableHead className="font-bold text-gray-700 dark:text-gray-300">Tytuł</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-gray-300">Klient</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-gray-300">Data i czas</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-gray-300">Czas trwania</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-gray-300">Lokalizacja</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-gray-300">Status</TableHead>
                  <TableHead className="font-bold text-gray-700 dark:text-gray-300">Przypomnienie</TableHead>
                  <TableHead className="text-right font-bold text-gray-700 dark:text-gray-300">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">Brak spotkań</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((appointment) => {
                    const client = clients.find(c => c.id === appointment.client_id);
                    return (
                      <TableRow 
                        key={appointment.id}
                        className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-sky-50/50 dark:hover:from-blue-900/20 dark:hover:to-sky-900/20 transition-all duration-200"
                      >
                        <TableCell className="font-semibold text-gray-900 dark:text-gray-100">{appointment.title}</TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{client?.name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <Clock className="w-4 h-4 text-blue-500" />
                            {formatDateTime(appointment.date, appointment.time)}
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-700 dark:text-gray-300">{appointment.duration} min</TableCell>
                        <TableCell>
                          {appointment.location ? (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <MapPin className="w-4 h-4 text-blue-500" />
                              {appointment.location}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                        <TableCell>
                          {appointment.reminder_minutes > 0 ? (
                            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Bell className="w-4 h-4 text-blue-500" />
                              {appointment.reminder_minutes} min
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDialog(appointment)}
                              className="hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:scale-110 transition-all"
                            >
                              <PencilSimple className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(appointment.id)}
                              className="hover:bg-red-100 dark:hover:bg-red-900/40 hover:scale-110 transition-all"
                            >
                              <Trash className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog dodawania/edycji */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAppointment ? 'Edytuj spotkanie' : 'Nowe spotkanie'}
            </DialogTitle>
            <DialogDescription>
              Uzupełnij szczegóły spotkania
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tytuł */}
            <div>
              <Label htmlFor="title">Tytuł spotkania *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="np. Prezentacja oferty"
                required
              />
            </div>

            {/* Klient */}
            <div>
              <Label htmlFor="client_id">Klient (opcjonalnie)</Label>
              <Select 
                value={formData.client_id || 'none'} 
                onValueChange={(value) => setFormData({ ...formData, client_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz klienta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data i czas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="time">Godzina *</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Czas trwania */}
            <div>
              <Label htmlFor="duration">Czas trwania (minuty)</Label>
              <Select 
                value={formData.duration.toString()} 
                onValueChange={(value) => setFormData({ ...formData, duration: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minut</SelectItem>
                  <SelectItem value="30">30 minut</SelectItem>
                  <SelectItem value="45">45 minut</SelectItem>
                  <SelectItem value="60">1 godzina</SelectItem>
                  <SelectItem value="90">1.5 godziny</SelectItem>
                  <SelectItem value="120">2 godziny</SelectItem>
                  <SelectItem value="180">3 godziny</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lokalizacja */}
            <div>
              <Label htmlFor="location">Lokalizacja</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="np. Biuro klienta, Online, Kawiarnia XYZ"
              />
            </div>

            {/* Przypomnienie */}
            <div>
              <Label htmlFor="reminder">Przypomnienie</Label>
              <Select 
                value={formData.reminder_minutes.toString()} 
                onValueChange={(value) => setFormData({ ...formData, reminder_minutes: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Bez przypomnienia</SelectItem>
                  <SelectItem value="10">10 minut przed</SelectItem>
                  <SelectItem value="15">15 minut przed</SelectItem>
                  <SelectItem value="30">30 minut przed</SelectItem>
                  <SelectItem value="60">1 godzinę przed</SelectItem>
                  <SelectItem value="120">2 godziny przed</SelectItem>
                  <SelectItem value="1440">1 dzień przed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status (tylko przy edycji) */}
            {editingAppointment && (
              <div>
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Zaplanowane</SelectItem>
                    <SelectItem value="completed">Zakończone</SelectItem>
                    <SelectItem value="cancelled">Anulowane</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Opis */}
            <div>
              <Label htmlFor="description">Notatki</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Dodatkowe informacje o spotkaniu..."
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Anuluj
              </Button>
              <Button type="submit">
                <Check className="w-4 h-4 mr-2" />
                {editingAppointment ? 'Zapisz zmiany' : 'Dodaj spotkanie'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
