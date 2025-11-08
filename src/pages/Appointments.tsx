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
        return <Badge variant="default" className="bg-blue-500">Zaplanowane</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Zakończone</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Anulowane</Badge>;
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
          className={`h-32 border border-gray-200 dark:border-gray-700 p-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
            isToday ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' : 'bg-white dark:bg-gray-800'
          }`}
        >
          <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {day}
          </div>
          <div className="space-y-1 overflow-y-auto max-h-20">
            {dayAppointments.map((apt, idx) => (
              <div
                key={apt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDialog(apt);
                }}
                className={`text-xs p-1 rounded truncate ${
                  apt.status === 'scheduled' ? 'bg-blue-500 text-white' :
                  apt.status === 'completed' ? 'bg-green-500 text-white' :
                  'bg-red-500 text-white'
                }`}
                title={`${apt.time} - ${apt.title}`}
              >
                {apt.time} {apt.title}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Nawigacja kalendarza */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {monthNames[month]} {year}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Dzisiaj
            </Button>
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <CaretLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <CaretRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Nagłówki dni tygodnia */}
        <div className="grid grid-cols-7 gap-0">
          {dayNames.map(name => (
            <div key={name} className="text-center font-semibold text-gray-600 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-800">
              {name}
            </div>
          ))}
        </div>

        {/* Dni */}
        <div className="grid grid-cols-7 gap-0 border border-gray-200 dark:border-gray-700">
          {days}
        </div>

        {/* Legenda */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Zaplanowane</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Zakończone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Anulowane</span>
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Kalendarz Spotkań
              </CardTitle>
              <CardDescription>
                Zarządzaj spotkaniami z klientami i otrzymuj powiadomienia
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className={viewMode === 'calendar' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Kalendarz
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={viewMode === 'list' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                >
                  <List className="w-4 h-4 mr-2" />
                  Lista
                </Button>
              </div>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Nowe spotkanie
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {viewMode === 'calendar' ? (
            renderCalendar()
          ) : (
            <>
              {/* Filtry */}
              <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Szukaj spotkań..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="scheduled">Zaplanowane</SelectItem>
                <SelectItem value="completed">Zakończone</SelectItem>
                <SelectItem value="cancelled">Anulowane</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela spotkań */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tytuł</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Data i czas</TableHead>
                  <TableHead>Czas trwania</TableHead>
                  <TableHead>Lokalizacja</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Przypomnienie</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Brak spotkań
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((appointment) => {
                    const client = clients.find(c => c.id === appointment.client_id);
                    return (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">{appointment.title}</TableCell>
                        <TableCell>{client?.name || '-'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {formatDateTime(appointment.date, appointment.time)}
                          </div>
                        </TableCell>
                        <TableCell>{appointment.duration} min</TableCell>
                        <TableCell>
                          {appointment.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-400" />
                              {appointment.location}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                        <TableCell>
                          {appointment.reminder_minutes > 0 ? (
                            <div className="flex items-center gap-2">
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
                            >
                              <PencilSimple className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(appointment.id)}
                            >
                              <Trash className="w-4 h-4 text-red-500" />
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
                value={formData.client_id} 
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz klienta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Brak</SelectItem>
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
