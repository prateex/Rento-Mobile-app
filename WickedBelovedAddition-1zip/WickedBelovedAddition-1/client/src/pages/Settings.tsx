import MobileLayout from "@/components/layout/MobileLayout";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Store, Users, FileText, Shield, ChevronRight, Eye, EyeOff, Plus, UserPlus, Calendar, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export default function Settings() {
  const { user, logout, settings, toggleRevenueVisibility, toggleBackdateOverride, users, addUser, removeUser, whatsappTemplates, updateWhatsappTemplate } = useStore();
  const [, setLocation] = useLocation();
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [bookingConfirmationEdit, setBookingConfirmationEdit] = useState(whatsappTemplates.bookingConfirmation);
  const [paymentConfirmationEdit, setPaymentConfirmationEdit] = useState(whatsappTemplates.paymentConfirmation);
  const [invoiceMessageEdit, setInvoiceMessageEdit] = useState(whatsappTemplates.invoiceMessage);
  const { toast } = useToast();

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
                 
                 {user?.role === 'admin' && (
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
                  <Input defaultValue="City Bike Rentals" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input defaultValue="123 MG Road, Bangalore" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input defaultValue="support@citybike.com" />
                </div>
                <Button className="w-full mt-2">Save Changes</Button>
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

        <Button variant="destructive" className="w-full mt-6 h-12 rounded-xl" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Log Out
        </Button>
        
        <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
           <DialogContent className="sm:max-w-md top-[20%] translate-y-0">
              <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
              <AddStaffForm />
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
