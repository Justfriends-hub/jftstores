-- Auto-grant 'seller' role when a user creates a seller profile
DROP TRIGGER IF EXISTS on_seller_created ON public.sellers;
CREATE TRIGGER on_seller_created
AFTER INSERT ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.handle_new_seller();