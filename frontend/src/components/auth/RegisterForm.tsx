import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../../services/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../ui/card";
import type { User } from "../../types";

interface RegisterFormProps {
  setUser: (user: User) => void;
}

const RegisterForm = ({ setUser }: RegisterFormProps) => {
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", role: "patient" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.register(form);
      const loginRes = await authService.login({ email: form.email, password: form.password });
      localStorage.setItem("token", loginRes.data.access_token);
      const userRes = await authService.getCurrentUser();
      setUser(userRes.data);
      navigate("/dashboard");
    } catch {
      setError("Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">MediTrack</h1>
          <p className="text-gray-500 mt-1">Personal Health Records</p>
        </div>
        <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-semibold text-gray-800">Create Account</CardTitle>
            <p className="text-gray-500 text-sm">Join MediTrack today</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="First Name" value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required className="h-11 bg-gray-50 border-gray-200 focus:border-blue-500" />
                <Input placeholder="Last Name" value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} required className="h-11 bg-gray-50 border-gray-200 focus:border-blue-500" />
              </div>
              <div>
                <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="h-11 bg-gray-50 border-gray-200 focus:border-blue-500" />
              </div>
              <div>
                <Input placeholder="Password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required className="h-11 bg-gray-50 border-gray-200 focus:border-blue-500" />
              </div>
              <div>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="h-11 w-full rounded-md border border-gray-200 px-3 bg-gray-50 focus:border-blue-500">
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                </select>
              </div>
              {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded-lg text-center">{error}</p>}
              <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg shadow-md transition-all">Create Account</Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center pt-2">
            <p className="text-gray-500 text-sm">Already have an account? <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign In</Link></p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default RegisterForm;