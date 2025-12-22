import { Switch, Route, Redirect } from "wouter";
import { useStore } from "@/lib/store";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Bikes from "@/pages/Bikes";
import Customers from "@/pages/Customers";
import Bookings from "@/pages/Bookings";
import Settings from "@/pages/Settings";
import { Toaster } from "@/components/ui/toaster";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const user = useStore((state) => state.user);
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function App() {
  return (
    <>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/">
          <PrivateRoute component={Dashboard} />
        </Route>
        <Route path="/bikes">
           <PrivateRoute component={Bikes} />
        </Route>
        <Route path="/bookings">
           <PrivateRoute component={Bookings} />
        </Route>
        <Route path="/bookings/new">
           <PrivateRoute component={Bookings} />
        </Route>
        <Route path="/customers">
           <PrivateRoute component={Customers} />
        </Route>
         <Route path="/settings">
           <PrivateRoute component={Settings} />
        </Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
      <Toaster />
    </>
  );
}

export default App;
