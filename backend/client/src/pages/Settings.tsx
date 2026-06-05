import MobileLayout from "@/components/layout/MobileLayout";
import { useStore, getPermissions, type ShopPickupPoint } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Store, Users, FileText, Shield, ChevronRight, Eye, EyeOff, Plus, UserPlus, Calendar, MessageCircle, BarChart3, Check, ChevronsUpDown } from "lucide-react";
import { useLocation } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { fetchIndiaCities, fetchIndiaPincodes, fetchIndiaStates, type IndiaCity, type IndiaPincode, type IndiaState } from "@/lib/indiaLocationService";

export default function Settings() {
  const { user, logout, settings, toggleRevenueVisibility, toggleBackdateOverride, users, addUser, removeUser, whatsappTemplates, updateWhatsappTemplate, shopDetails, updateShopDetails, pickupPoints, fetchPickupPoints, addPickupPoint, updatePickupPoint, setDefaultPickupPoint, disablePickupPoint } = useStore();
  const permissions = getPermissions(user?.role || null);
  const [, setLocation] = useLocation();
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [bookingConfirmationEdit, setBookingConfirmationEdit] = useState(whatsappTemplates.bookingConfirmation);
  const [paymentConfirmationEdit, setPaymentConfirmationEdit] = useState(whatsappTemplates.paymentConfirmation);
  const [invoiceMessageEdit, setInvoiceMessageEdit] = useState(whatsappTemplates.invoiceMessage);
  const [shopName, setShopName] = useState(shopDetails.name || '');
  const [shopAddress, setShopAddress] = useState(shopDetails.address || '');
  const [shopEmail, setShopEmail] = useState(shopDetails.email || '');
  const [shopPhone, setShopPhone] = useState(shopDetails.phone || '');
  const [shopGst, setShopGst] = useState(shopDetails.gstNumber || '');
  const [terms, setTerms] = useState(shopDetails.termsAndConditions || '');
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [editingPickupPoint, setEditingPickupPoint] = useState<ShopPickupPoint | null>(null);
  const [pickupFormName, setPickupFormName] = useState('');
  const [pickupFormState, setPickupFormState] = useState('');
  const [pickupFormCity, setPickupFormCity] = useState('');
  const [pickupFormPincode, setPickupFormPincode] = useState('');
  const [pickupFormAddress, setPickupFormAddress] = useState('');
  const [pickupFormLatitude, setPickupFormLatitude] = useState<number | null>(null);
  const [pickupFormLongitude, setPickupFormLongitude] = useState<number | null>(null);
  const [pickupFormIsDefault, setPickupFormIsDefault] = useState(false);
  const [states, setStates] = useState<IndiaState[]>([]);
  const [cities, setCities] = useState<IndiaCity[]>([]);
  const [pincodes, setPincodes] = useState<IndiaPincode[]>([]);
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedPincodeId, setSelectedPincodeId] = useState<string | null>(null);
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [pincodeOpen, setPincodeOpen] = useState(false);
  const [stateLoading, setStateLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [cityIsOther, setCityIsOther] = useState(false);
  const [pincodeIsOther, setPincodeIsOther] = useState(false);
  const [pickupMapVisible, setPickupMapVisible] = useState(false);
  const [pickupMapCenter, setPickupMapCenter] = useState<[number, number]>([15.4909, 73.8278]);
  const [pickupMarkerPosition, setPickupMarkerPosition] = useState<[number, number] | null>(null);
  const [mapModules, setMapModules] = useState<null | {
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    useMapEvents: any;
  }>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [reverseGeocodeStatus, setReverseGeocodeStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [reverseGeocodeError, setReverseGeocodeError] = useState<string | null>(null);
  const [pickupSaving, setPickupSaving] = useState(false);
  const reverseGeocodeTimer = useRef<number | null>(null);
  const { toast } = useToast();

  const hasValidCoords = (lat: number | null, lng: number | null) =>
    lat !== null &&
    lng !== null &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  const formatCoord = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return '—';
    return value.toFixed(6);
  };

  const scheduleReverseGeocode = (lat: number, lng: number) => {
    if (reverseGeocodeTimer.current) {
      window.clearTimeout(reverseGeocodeTimer.current);
    }
    reverseGeocodeTimer.current = window.setTimeout(() => {
      void reverseGeocode(lat, lng);
    }, 700);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    setReverseGeocodeStatus('loading');
    setReverseGeocodeError(null);
    try {
      // Call backend proxy instead of direct Nominatim API (avoids CORS issues)
      const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);

      if (!response.ok) {
        throw new Error('Failed to detect address');
      }

      const data = await response.json();
      const address = data?.address || {};
      const city = address.city || address.town || address.village || address.county || '';
      const state = address.state || '';
      const postcode = address.postcode || '';

      if (data?.display_name) {
        setPickupFormAddress(data.display_name);
      }
      if (city) setPickupFormCity(city);
      if (state) setPickupFormState(state);
      if (postcode) setPickupFormPincode(postcode);

      setReverseGeocodeStatus('idle');
    } catch (error) {
      setReverseGeocodeStatus('error');
      setReverseGeocodeError(error instanceof Error ? error.message : 'Unable to detect address');
    }
  };

  const updateMarkerPosition = (lat: number, lng: number, shouldReverseGeocode = true) => {
    setPickupFormLatitude(lat);
    setPickupFormLongitude(lng);
    setPickupMarkerPosition([lat, lng]);
    setPickupMapCenter([lat, lng]);
    if (shouldReverseGeocode) {
      scheduleReverseGeocode(lat, lng);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setMapError('Geolocation is not supported on this device.');
      return;
    }

    setMapError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setPickupMapVisible(true);
        updateMarkerPosition(lat, lng, true);
      },
      (error) => {
        let message = 'Unable to access your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. You can still place the pin manually.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Try again or place the pin manually.';
        }
        setMapError(message);
        setPickupMapVisible(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const handleManualMap = () => {
    setMapError(null);
    setPickupMapVisible(true);
  };

  const clearPickupLocation = () => {
    setPickupFormLatitude(null);
    setPickupFormLongitude(null);
    setPickupMarkerPosition(null);
    setPickupFormAddress('');
    setReverseGeocodeStatus('idle');
    setReverseGeocodeError(null);
    setPickupMapVisible(false);
  };

  const defaultPickupPoint = pickupPoints.find((point) => point.isDefault) || pickupPoints[0];

  const resetPickupFormSelectors = () => {
    setSelectedStateId(null);
    setSelectedCityId(null);
    setSelectedPincodeId(null);
    setCities([]);
    setPincodes([]);
    setCityIsOther(false);
    setPincodeIsOther(false);
  };

  const openAddPickupPoint = () => {
    const fallbackLat = shopDetails.pickupLatitude ?? shopDetails.pickupLat ?? 15.4909;
    const fallbackLng = shopDetails.pickupLongitude ?? shopDetails.pickupLng ?? 73.8278;
    const seedLat =
      defaultPickupPoint && hasValidCoords(defaultPickupPoint.latitude, defaultPickupPoint.longitude)
        ? defaultPickupPoint.latitude!
        : fallbackLat;
    const seedLng =
      defaultPickupPoint && hasValidCoords(defaultPickupPoint.latitude, defaultPickupPoint.longitude)
        ? defaultPickupPoint.longitude!
        : fallbackLng;

    setEditingPickupPoint(null);
    setPickupFormName('');
    setPickupFormState('');
    setPickupFormCity('');
    setPickupFormPincode('');
    setPickupFormAddress('');
    setPickupFormLatitude(seedLat);
    setPickupFormLongitude(seedLng);
    setPickupFormIsDefault(pickupPoints.length === 0);
    setPickupMapCenter([seedLat, seedLng]);
    setPickupMarkerPosition([seedLat, seedLng]);
    setPickupMapVisible(true);
    resetPickupFormSelectors();
    setPickupModalOpen(true);
  };

  const openEditPickupPoint = (point: ShopPickupPoint) => {
    const fallbackLat = shopDetails.pickupLatitude ?? shopDetails.pickupLat ?? 15.4909;
    const fallbackLng = shopDetails.pickupLongitude ?? shopDetails.pickupLng ?? 73.8278;
    const lat = hasValidCoords(point.latitude, point.longitude) ? point.latitude! : fallbackLat;
    const lng = hasValidCoords(point.latitude, point.longitude) ? point.longitude! : fallbackLng;

    setEditingPickupPoint(point);
    setPickupFormName(point.name);
    setPickupFormState('');
    setPickupFormCity(point.city || '');
    setPickupFormPincode(point.pincode || '');
    setPickupFormAddress(point.addressText || '');
    setPickupFormLatitude(lat);
    setPickupFormLongitude(lng);
    setPickupFormIsDefault(point.isDefault);
    setPickupMapCenter([lat, lng]);
    setPickupMarkerPosition([lat, lng]);
    setPickupMapVisible(true);
    resetPickupFormSelectors();
    setPickupModalOpen(true);
  };

  const handleSavePickupPoint = async () => {
    if (!pickupFormName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a pickup point name.', variant: 'destructive' });
      return;
    }
    if (!hasValidCoords(pickupFormLatitude, pickupFormLongitude)) {
      toast({ title: 'Location required', description: 'Place a pin on the map or use your current location.', variant: 'destructive' });
      return;
    }

    const isDefault = pickupFormIsDefault || pickupPoints.length === 0;
    const payload = {
      name: pickupFormName.trim(),
      latitude: pickupFormLatitude!,
      longitude: pickupFormLongitude!,
      addressText: pickupFormAddress || undefined,
      city: pickupFormCity || undefined,
      pincode: pickupFormPincode || undefined,
      isDefault,
    };

    setPickupSaving(true);
    try {
      if (editingPickupPoint) {
        await updatePickupPoint(editingPickupPoint.id, payload);
        toast({ title: 'Pickup point updated', description: 'Changes saved successfully.' });
      } else {
        await addPickupPoint(payload);
        toast({ title: 'Pickup point added', description: 'New pickup point saved.' });
      }
      await fetchPickupPoints();
      setPickupModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save pickup point';
      console.error('[handleSavePickupPoint]', error);
      toast({ title: 'Could not save pickup point', description: message, variant: 'destructive' });
    } finally {
      setPickupSaving(false);
    }
  };

  const handleDisablePickupPoint = async (point: ShopPickupPoint) => {
    if (pickupPoints.length <= 1) {
      toast({ title: 'Cannot disable', description: 'At least one active pickup point is required.', variant: 'destructive' });
      return;
    }

    try {
      await disablePickupPoint(point.id);
      await fetchPickupPoints();
      toast({
        title: point.isDefault ? 'Pickup point disabled' : 'Pickup point disabled',
        description: point.isDefault
          ? 'A new default pickup point was selected automatically.'
          : 'Pickup point removed from the active list.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disable pickup point';
      toast({ title: 'Could not disable', description: message, variant: 'destructive' });
    }
  };

  const handleSetDefaultPickupPoint = async (pointId: string) => {
    try {
      await setDefaultPickupPoint(pointId);
      await fetchPickupPoints();
      toast({ title: 'Default updated', description: 'This pickup point is now the default.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set default';
      toast({ title: 'Could not set default', description: message, variant: 'destructive' });
    }
  };

  const loadStates = async () => {
    setStateLoading(true);
    const data = await fetchIndiaStates();
    setStates(data);
    setStateLoading(false);
  };

  const loadCities = async (stateId: string, openAfterLoad = false) => {
    setCityLoading(true);
    const data = await fetchIndiaCities(stateId);
    setCities(data);
    setCityLoading(false);
    if (openAfterLoad) setCityOpen(true);
  };

  const loadPincodes = async (cityId: string, openAfterLoad = false) => {
    setPincodeLoading(true);
    const data = await fetchIndiaPincodes(cityId);
    setPincodes(data);
    setPincodeLoading(false);
    if (openAfterLoad) setPincodeOpen(true);
  };

  useEffect(() => {
    if (!pickupModalOpen) return;
    if (states.length === 0 && !stateLoading) {
      void loadStates();
    }
  }, [pickupModalOpen, states.length, stateLoading]);

  useEffect(() => {
    if (!permissions.canViewAdminPanel) return;
    void fetchPickupPoints();
  }, [permissions.canViewAdminPanel, fetchPickupPoints]);

  useEffect(() => {
    if (!pickupModalOpen || !pickupFormState || selectedStateId || states.length === 0) return;
    const match = states.find((state) => state.name === pickupFormState);
    if (match) {
      setSelectedStateId(match.id);
      void loadCities(match.id);
    }
  }, [pickupModalOpen, pickupFormState, selectedStateId, states]);

  useEffect(() => {
    if (!pickupModalOpen || !pickupFormCity || selectedCityId || cities.length === 0) return;
    const match = cities.find((city) => city.name === pickupFormCity);
    if (match) {
      setSelectedCityId(match.id);
      void loadPincodes(match.id);
    } else if (pickupFormCity) {
      setCityIsOther(true);
    }
  }, [pickupModalOpen, pickupFormCity, selectedCityId, cities]);

  useEffect(() => {
    if (!pickupModalOpen || !pickupFormPincode || selectedPincodeId || pincodes.length === 0) return;
    const match = pincodes.find((pin) => pin.pincode === pickupFormPincode);
    if (match) {
      setSelectedPincodeId(match.id);
    } else if (pickupFormPincode) {
      setPincodeIsOther(true);
    }
  }, [pickupModalOpen, pickupFormPincode, selectedPincodeId, pincodes]);

  useEffect(() => {
    if (permissions.canViewAdminPanel && !mapModules && !mapLoading) {
      void (async () => {
        setMapLoading(true);
        try {
          const [leafletModule, reactLeaflet] = await Promise.all([
            import('leaflet'),
            import('react-leaflet'),
            import('leaflet/dist/leaflet.css'),
          ]);
          const leaflet = (leafletModule as any).default ?? leafletModule;
          delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
          leaflet.Icon.Default.mergeOptions({
            iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
            iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
            shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
          });
          setMapModules({
            MapContainer: reactLeaflet.MapContainer,
            TileLayer: reactLeaflet.TileLayer,
            Marker: reactLeaflet.Marker,
            useMapEvents: reactLeaflet.useMapEvents,
          });
        } catch {
          setMapError('Unable to load the map. Please refresh and try again.');
        } finally {
          setMapLoading(false);
        }
      })();
    }
  }, [permissions.canViewAdminPanel, mapModules, mapLoading]);

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const AddStaffForm = () => {
     const { register, handleSubmit } = useForm();
     const onSubmit = (data: any) => {
        addUser({
           id: Math.random().toString(36).substr(2, 9),
           name: data.name,
           phone: data.phone,
           role: 'staff',
           email: data.email
        });
        setIsAddStaffOpen(false);
        toast({ title: "Staff Added", description: `Invite sent to ${data.name}` });
     };
     return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
           <div className="space-y-2">
              <Label>Name</Label>
              <Input {...register("name", { required: true })} />
           </div>
           <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register("phone", { required: true })} />
           </div>
           <div className="space-y-2">
              <Label>Email (Optional)</Label>
              <Input {...register("email")} />
           </div>
           <Button className="w-full">Add Staff Member</Button>
        </form>
     );
  }

  const MapContainer = mapModules?.MapContainer;
  const TileLayer = mapModules?.TileLayer;
  const Marker = mapModules?.Marker;
  const useMapEvents = mapModules?.useMapEvents;
  const hasPickupFormCoordinates = pickupFormLatitude !== null && pickupFormLongitude !== null;
  const previewCoordinates =
    defaultPickupPoint && hasValidCoords(defaultPickupPoint.latitude, defaultPickupPoint.longitude)
      ? ([defaultPickupPoint.latitude!, defaultPickupPoint.longitude!] as [number, number])
      : null;

  const MapEvents = () => {
    if (!useMapEvents) return null;
    useMapEvents({
      click: (event: any) => {
        if (!event?.latlng) return;
        updateMarkerPosition(event.latlng.lat, event.latlng.lng, true);
      },
    });
    return null;
  };

  return (
    <MobileLayout>
      <div className="p-4 space-y-6 min-h-screen pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Profile Card */}
        <Card className="border-none bg-zinc-900 text-white shadow-lg">
          <CardContent className="p-4 flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{user?.name}</h2>
              <p className="text-zinc-400 text-sm capitalize">{user?.role}</p>
              <p className="text-zinc-500 text-xs mt-1">{user?.phone}</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="shop" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-zinc-100 p-1 rounded-xl">
            <TabsTrigger value="shop" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Shop</TabsTrigger>
            <TabsTrigger value="messages" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Messages</TabsTrigger>
            <TabsTrigger value="staff" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Staff</TabsTrigger>
          </TabsList>
          
          <TabsContent value="shop" className="space-y-4 mt-4 animate-in slide-in-from-left-4 duration-300">
            <Card className="border-zinc-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store size={18} className="text-primary-600" /> Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 {permissions.canViewAdminPanel && (
                   <div className="flex items-center justify-between">
                     <div className="space-y-0.5">
                       <Label className="text-base">Show Revenue</Label>
                       <p className="text-xs text-muted-foreground">Display revenue on dashboard</p>
                     </div>
                     <Switch 
                       checked={settings.showRevenueOnDashboard}
                       onCheckedChange={toggleRevenueVisibility}
                     />
                   </div>
                 )}
                 
                 {permissions.canViewAdminPanel && (
                   <div className="flex items-center justify-between pt-2 border-t">
                     <div className="space-y-0.5">
                       <Label className="text-base flex items-center gap-2">
                         <Calendar size={14} /> Allow Back-dating
                       </Label>
                       <p className="text-xs text-muted-foreground">Allow bookings older than 7 days</p>
                     </div>
                     <Switch 
                       checked={settings.allowBackdateOverride}
                       onCheckedChange={toggleBackdateOverride}
                     />
                   </div>
                 )}
              </CardContent>
            </Card>

            <Card className="border-zinc-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store size={18} className="text-primary-600" /> Shop Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Shop Name</Label>
                  <Input value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="City Bike Rentals" disabled={!permissions.canViewAdminPanel} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} placeholder="123 MG Road, Bangalore" disabled={!permissions.canViewAdminPanel} />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} placeholder="support@citybike.com" disabled={!permissions.canViewAdminPanel} />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input type="tel" value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} placeholder="9876543210" disabled={!permissions.canViewAdminPanel} />
                </div>
                {permissions.canViewAdminPanel && (
                  <div className="space-y-2">
                    <Label>GST Number (Optional)</Label>
                    <Input value={shopGst} onChange={(e) => setShopGst(e.target.value)} placeholder="22AAAAA0000A1Z5" />
                    <p className="text-xs text-muted-foreground">Will be shown on invoices if provided</p>
                  </div>
                )}
                {permissions.canViewAdminPanel && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center justify-between">
                      <Label>Pickup Locations</Label>
                      <Button size="sm" variant="outline" onClick={openAddPickupPoint}>
                        ➕ Add pickup point
                      </Button>
                    </div>
                    {previewCoordinates && MapContainer && TileLayer && (
                      <div className="rounded-lg border bg-white p-2 space-y-2">
                        <div className="h-52 w-full overflow-hidden rounded">
                          <MapContainer
                            key={`${previewCoordinates[0]}-${previewCoordinates[1]}`}
                            center={previewCoordinates}
                            zoom={16}
                            scrollWheelZoom={false}
                            className="h-full w-full"
                          >
                            <TileLayer
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {Marker && (
                              <Marker position={previewCoordinates} />
                            )}
                          </MapContainer>
                        </div>
                        {defaultPickupPoint && (
                          <p className="text-xs text-muted-foreground">
                            Default: <span className="font-medium text-foreground">{defaultPickupPoint.name}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {pickupPoints.length === 0 && (
                      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                        Please add a pickup point to start accepting bookings.
                      </div>
                    )}
                    <div className="space-y-2">
                      {pickupPoints.map((point) => (
                        <div key={point.id} className="border rounded-lg p-3 bg-white space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold">
                                {point.name}
                                {point.isDefault && (
                                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">DEFAULT</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {point.addressText || 'Address not set'}
                              </p>
                              {(point.city || point.pincode) && (
                                <p className="text-[11px] text-muted-foreground">
                                  {[point.city, point.pincode].filter(Boolean).join(' • ')}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 justify-end">
                              <Button size="sm" variant="outline" onClick={() => openEditPickupPoint(point)}>
                                ✏️ Edit
                              </Button>
                              {!point.isDefault && (
                                <Button size="sm" variant="secondary" onClick={() => handleSetDefaultPickupPoint(point.id)}>
                                  ⭐ Set default
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDisablePickupPoint(point)}
                                disabled={pickupPoints.length <= 1}
                              >
                                🗑️ Disable
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {permissions.canViewAdminPanel && (
                  <div className="space-y-2">
                    <Label>Terms & Conditions</Label>
                    <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Enter owner-specific terms for customers" />
                  </div>
                )}
                <Button className="w-full mt-2" onClick={() => {
                  updateShopDetails({
                    name: shopName || undefined,
                    address: shopAddress || undefined,
                    email: shopEmail || undefined,
                    phone: shopPhone || undefined,
                    gstNumber: shopGst || undefined,
                    termsAndConditions: terms || undefined
                  });
                  toast({ title: 'Saved', description: 'Shop details updated successfully' });
                }} disabled={!permissions.canViewAdminPanel}>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4 mt-4 animate-in slide-in-from-left-4 duration-300">
            <Card className="border-zinc-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle size={18} className="text-green-600" /> WhatsApp Message Templates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Booking Confirmation */}
                <div className="space-y-2 pb-4 border-b">
                  <Label className="text-sm font-semibold">Booking Confirmation Message</Label>
                  <Textarea
                    value={bookingConfirmationEdit}
                    onChange={(e) => setBookingConfirmationEdit(e.target.value)}
                    className="min-h-[120px] text-xs resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Available variables: {'{customerName}'}, {'{bookingNumber}'}, {'{bikeName}'}, {'{regNo}'}, {'{startDate}'}, {'{endDate}'}, {'{totalAmount}'}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      updateWhatsappTemplate('bookingConfirmation', bookingConfirmationEdit);
                      toast({ title: "Saved", description: "Booking confirmation template updated." });
                    }}
                  >
                    Save Template
                  </Button>
                </div>

                {/* Payment Confirmation */}
                <div className="space-y-2 pb-4 border-b">
                  <Label className="text-sm font-semibold">Payment Confirmation Message</Label>
                  <Textarea
                    value={paymentConfirmationEdit}
                    onChange={(e) => setPaymentConfirmationEdit(e.target.value)}
                    className="min-h-[120px] text-xs resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Available variables: {'{customerName}'}, {'{bookingNumber}'}, {'{paidAmount}'}, {'{paymentMode}'}, {'{remainingBalance}'}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      updateWhatsappTemplate('paymentConfirmation', paymentConfirmationEdit);
                      toast({ title: "Saved", description: "Payment confirmation template updated." });
                    }}
                  >
                    Save Template
                  </Button>
                </div>

                {/* Invoice Message */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Invoice Message</Label>
                  <Textarea
                    value={invoiceMessageEdit}
                    onChange={(e) => setInvoiceMessageEdit(e.target.value)}
                    className="min-h-[120px] text-xs resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 Available variables: {'{customerName}'}, {'{bookingNumber}'}, {'{invoiceNumber}'}, {'{totalAmount}'}, {'{depositDeduction}'}, {'{refundAmount}'}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      updateWhatsappTemplate('invoiceMessage', invoiceMessageEdit);
                      toast({ title: "Saved", description: "Invoice message template updated." });
                    }}
                  >
                    Save Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="staff" className="space-y-4 mt-4 animate-in slide-in-from-right-4 duration-300">
             <Card className="border-zinc-100 shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users size={18} className="text-primary-600" /> Staff Members
                </CardTitle>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsAddStaffOpen(true)}>
                   <Plus size={12} className="mr-1" /> Add Staff
                </Button>
              </CardHeader>
              <CardContent className="space-y-0">
                 {users.map(staff => (
                    <div key={staff.id} className="flex items-center justify-between py-3 border-b border-zinc-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold">
                           {staff.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{staff.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
                        </div>
                      </div>
                      {staff.id !== user?.id && (
                        <Button variant="ghost" size="sm" className="text-xs text-red-500 h-7" onClick={() => removeUser(staff.id)}>Remove</Button>
                      )}
                    </div>
                 ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions - Only show Reports for Owner/Admin */}
        {permissions.canViewAdminPanel && (
          <Card className="border-zinc-100 shadow-sm cursor-pointer hover:border-primary transition-colors" onClick={() => setLocation('/reports')}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <BarChart3 size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">Reports & Analytics</h3>
                  <p className="text-xs text-muted-foreground">View booking statistics</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        <Button variant="destructive" className="w-full mt-6 h-12 rounded-xl" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Log Out
        </Button>
        
        <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
           <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
              <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
              <AddStaffForm />
           </DialogContent>
        </Dialog>

        <Dialog open={pickupModalOpen} onOpenChange={setPickupModalOpen}>
          <DialogContent className="sm:max-w-md top-[5%] translate-y-0 h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPickupPoint ? 'Edit Pickup Point' : 'Add Pickup Point'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Pickup Point Name</Label>
                <Input
                  value={pickupFormName}
                  onChange={(e) => setPickupFormName(e.target.value)}
                  placeholder="e.g., Main Branch, Airport, Bus Stand"
                />
              </div>

              <div className="space-y-2">
                <Label>Pickup Location (Map)</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={handleUseCurrentLocation}>
                    📍 Use my current location
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleManualMap}>
                    Place pin manually
                  </Button>
                  {hasPickupFormCoordinates && (
                    <Button type="button" size="sm" variant="ghost" onClick={clearPickupLocation}>
                      Clear location
                    </Button>
                  )}
                </div>
                {mapError && (
                  <p className="text-xs text-red-600">{mapError}</p>
                )}
                {pickupMapVisible && (
                  <div className="rounded-lg border bg-white p-2 space-y-2">
                    {mapLoading && (
                      <p className="text-xs text-muted-foreground">Loading map...</p>
                    )}
                    {!mapLoading && MapContainer && TileLayer && (
                      <div className="h-56 w-full overflow-hidden rounded">
                        <MapContainer
                          key={`${pickupMapCenter[0]}-${pickupMapCenter[1]}`}
                          center={pickupMapCenter}
                          zoom={16}
                          scrollWheelZoom={false}
                          className="h-full w-full"
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <MapEvents />
                          {Marker && pickupMarkerPosition && (
                            <Marker
                              position={pickupMarkerPosition}
                              draggable
                              eventHandlers={{
                                drag: (event: any) => {
                                  const position = event?.target?.getLatLng?.();
                                  if (!position) return;
                                  updateMarkerPosition(position.lat, position.lng, true);
                                },
                                dragend: (event: any) => {
                                  const position = event?.target?.getLatLng?.();
                                  if (!position) return;
                                  updateMarkerPosition(position.lat, position.lng, true);
                                },
                              }}
                            />
                          )}
                        </MapContainer>
                      </div>
                    )}
                    {!mapLoading && !MapContainer && (
                      <p className="text-xs text-muted-foreground">Loading map...</p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <p>Latitude: {formatCoord(pickupFormLatitude)}</p>
                      <p>Longitude: {formatCoord(pickupFormLongitude)}</p>
                      <p className="mt-1">Tap the map to place the pin and drag to adjust.</p>
                    </div>
                    {reverseGeocodeStatus === 'loading' && (
                      <p className="text-xs text-muted-foreground">Detecting address...</p>
                    )}
                    {reverseGeocodeStatus === 'error' && reverseGeocodeError && (
                      <p className="text-xs text-red-600">{reverseGeocodeError}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={pickupFormAddress}
                  onChange={(e) => setPickupFormAddress(e.target.value)}
                  placeholder="Detected address (editable)"
                />
              </div>

              <div className="space-y-2">
                <Label>State</Label>
                <Popover open={stateOpen} onOpenChange={setStateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      <span>{pickupFormState || "Select state"}</span>
                      {stateLoading ? <Spinner className="ml-2" /> : <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput placeholder="Search state..." />
                      <CommandList>
                        <CommandEmpty>{stateLoading ? "Loading states..." : "No states found."}</CommandEmpty>
                        <CommandGroup>
                          {pickupFormState && (
                            <CommandItem
                              value="__clear_state__"
                              onSelect={() => {
                                setPickupFormState('');
                                setPickupFormCity('');
                                setPickupFormPincode('');
                                resetPickupFormSelectors();
                                setStateOpen(false);
                              }}
                            >
                              Clear selection
                            </CommandItem>
                          )}
                          {states.map((state) => (
                            <CommandItem
                              key={state.id}
                              value={state.name}
                              onSelect={() => {
                                setPickupFormState(state.name);
                                setSelectedStateId(state.id);
                                setPickupFormCity('');
                                setPickupFormPincode('');
                                resetPickupFormSelectors();
                                setStateOpen(false);
                                void loadCities(state.id, true);
                              }}
                            >
                              <span className="flex items-center gap-2">
                                {pickupFormState === state.name && <Check className="h-4 w-4 text-primary" />}
                                {state.name}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Popover open={cityOpen} onOpenChange={setCityOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={!selectedStateId}
                    >
                      <span>{pickupFormCity || (selectedStateId ? "Select city" : "Select state first")}</span>
                      {cityLoading ? <Spinner className="ml-2" /> : <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput placeholder="Search city..." />
                      <CommandList>
                        <CommandEmpty>{cityLoading ? "Loading cities..." : "No cities found."}</CommandEmpty>
                        <CommandGroup>
                          {pickupFormCity && (
                            <CommandItem
                              value="__clear_city__"
                              onSelect={() => {
                                setPickupFormCity('');
                                setPickupFormPincode('');
                                setSelectedCityId(null);
                                setSelectedPincodeId(null);
                                setPincodes([]);
                                setCityIsOther(false);
                                setPincodeIsOther(false);
                                setCityOpen(false);
                              }}
                            >
                              Clear selection
                            </CommandItem>
                          )}
                          {cities.map((city) => (
                            <CommandItem
                              key={city.id}
                              value={city.name}
                              onSelect={() => {
                                setPickupFormCity(city.name);
                                setSelectedCityId(city.id);
                                setPickupFormPincode('');
                                setSelectedPincodeId(null);
                                setPincodes([]);
                                setCityIsOther(false);
                                setPincodeIsOther(false);
                                setCityOpen(false);
                                void loadPincodes(city.id, true);
                              }}
                            >
                              <span className="flex items-center gap-2">
                                {pickupFormCity === city.name && <Check className="h-4 w-4 text-primary" />}
                                {city.name}
                              </span>
                            </CommandItem>
                          ))}
                          <CommandItem
                            value="__other_city__"
                            onSelect={() => {
                              setCityIsOther(true);
                              setSelectedCityId(null);
                              setPickupFormCity('');
                              setPickupFormPincode('');
                              setSelectedPincodeId(null);
                              setPincodes([]);
                              setPincodeIsOther(false);
                              setCityOpen(false);
                            }}
                          >
                            Other (enter manually)
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {cityIsOther && (
                  <Input
                    className="mt-2"
                    placeholder="Enter city name"
                    value={pickupFormCity}
                    onChange={(e) => setPickupFormCity(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Pincode</Label>
                <Popover open={pincodeOpen} onOpenChange={setPincodeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                      disabled={!(selectedCityId || (cityIsOther && pickupFormCity.trim()))}
                    >
                      <span>
                        {pickupFormPincode || (selectedCityId || (cityIsOther && pickupFormCity.trim()) ? "Select pincode" : "Select city first")}
                      </span>
                      {pincodeLoading ? <Spinner className="ml-2" /> : <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0">
                    <Command>
                      <CommandInput placeholder="Search pincode..." />
                      <CommandList>
                        <CommandEmpty>{pincodeLoading ? "Loading pincodes..." : "No pincodes found."}</CommandEmpty>
                        <CommandGroup>
                          {pickupFormPincode && (
                            <CommandItem
                              value="__clear_pincode__"
                              onSelect={() => {
                                setPickupFormPincode('');
                                setSelectedPincodeId(null);
                                setPincodeIsOther(false);
                                setPincodeOpen(false);
                              }}
                            >
                              Clear selection
                            </CommandItem>
                          )}
                          {pincodes.map((pin) => (
                            <CommandItem
                              key={pin.id}
                              value={pin.pincode}
                              onSelect={() => {
                                setPickupFormPincode(pin.pincode);
                                setSelectedPincodeId(pin.id);
                                setPincodeIsOther(false);
                                setPincodeOpen(false);
                              }}
                            >
                              <span className="flex items-center gap-2">
                                {pickupFormPincode === pin.pincode && <Check className="h-4 w-4 text-primary" />}
                                {pin.pincode}
                              </span>
                            </CommandItem>
                          ))}
                          <CommandItem
                            value="__other_pincode__"
                            onSelect={() => {
                              setPincodeIsOther(true);
                              setSelectedPincodeId(null);
                              setPickupFormPincode('');
                              setPincodeOpen(false);
                            }}
                          >
                            Other (enter manually)
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {pincodeIsOther && (
                  <Input
                    className="mt-2"
                    placeholder="Enter pincode"
                    value={pickupFormPincode}
                    onChange={(e) => setPickupFormPincode(e.target.value)}
                  />
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Set as default pickup point</p>
                  <p className="text-xs text-muted-foreground">Used as the pre-selected pickup option.</p>
                </div>
                <Switch checked={pickupFormIsDefault} onCheckedChange={(checked) => setPickupFormIsDefault(checked)} />
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleSavePickupPoint} disabled={pickupSaving}>
                  {pickupSaving ? 'Saving...' : editingPickupPoint ? 'Save Changes' : 'Save Pickup Point'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setPickupModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          <p>BikeRental App v1.0.0</p>
          <p>Made with Replit</p>
        </div>
      </div>
    </MobileLayout>
  );
}
