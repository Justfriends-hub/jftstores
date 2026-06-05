import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Theme = {
  id: string;
  slug: string;
  name: string;
  css_config: Record<string, string>;
};

type SellerRow = {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  whatsapp_number: string | null;
  logo_url: string | null;
  banner_url: string | null;
  theme_id: string | null;
};

export function StoreSettings({ seller, onChange }: { seller: SellerRow; onChange: () => void }) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [form, setForm] = useState({
    business_name: seller.business_name,
    description: seller.description ?? "",
    whatsapp_number: seller.whatsapp_number ?? "",
  });
  const [themeId, setThemeId] = useState<string | null>(seller.theme_id);
  const [logoUrl, setLogoUrl] = useState(seller.logo_url);
  const [bannerUrl, setBannerUrl] = useState(seller.banner_url);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("themes").select("id, slug, name, css_config").order("name");
      setThemes((data ?? []) as Theme[]);
    })();
  }, []);

  async function uploadImage(file: File, kind: "logo" | "banner") {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { toast.error("Not signed in"); return; }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${uid}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("store-assets").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    const { data: pub } = supabase.storage.from("store-assets").getPublicUrl(path);
    if (kind === "logo") setLogoUrl(pub.publicUrl);
    else setBannerUrl(pub.publicUrl);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("sellers")
      .update({
        business_name: form.business_name.trim().slice(0, 100),
        description: form.description.trim().slice(0, 2000) || null,
        whatsapp_number: form.whatsapp_number.trim().slice(0, 30) || null,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        theme_id: themeId,
      })
      .eq("id", seller.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Store updated");
    onChange();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-serif text-lg">Branding</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Business name</Label>
              <Input value={form.business_name} onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))} maxLength={100} />
            </div>
            <div>
              <Label>WhatsApp number</Label>
              <Input value={form.whatsapp_number} onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))} placeholder="+30…" maxLength={30} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={2000} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Logo</Label>
              <div className="mt-1 flex items-center gap-3">
                {logoUrl && <img src={logoUrl} alt="logo" className="h-12 w-12 rounded-md object-cover border" />}
                <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()}>Upload</Button>
                <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "logo")} />
                {logoUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>Remove</Button>}
              </div>
            </div>
            <div>
              <Label>Banner</Label>
              <div className="mt-1 flex items-center gap-3">
                {bannerUrl && <img src={bannerUrl} alt="banner" className="h-12 w-24 rounded-md object-cover border" />}
                <Button type="button" variant="outline" size="sm" onClick={() => bannerRef.current?.click()}>Upload</Button>
                <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")} />
                {bannerUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setBannerUrl(null)}>Remove</Button>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="font-serif text-lg">Theme</h3>
          <p className="text-sm text-muted-foreground">Pick the look and feel of your storefront. Customers see this when they visit.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {themes.map((t) => {
              const c = t.css_config;
              const selected = themeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  className={`text-left rounded-lg border-2 overflow-hidden transition ${selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/30"}`}
                >
                  <div className="h-20 flex" style={{ background: c.bg }}>
                    <div className="flex-1 p-2" style={{ color: c.text }}>
                      <div className="text-xs font-semibold truncate" style={{ fontFamily: c.fontHead }}>{t.name}</div>
                      <div className="text-[10px] truncate" style={{ color: c.muted, fontFamily: c.fontBody }}>Body text</div>
                    </div>
                    <div className="w-6" style={{ background: c.primary }} />
                    <div className="w-3" style={{ background: c.accent }} />
                  </div>
                  <div className="px-2 py-1.5 text-xs flex items-center justify-between bg-background">
                    <span>{t.name}</span>
                    {selected && <span className="text-primary text-[10px]">✓ selected</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="rounded-full">{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}
