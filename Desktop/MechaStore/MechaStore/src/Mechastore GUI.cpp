//---------------------------------------------------------------------------

#include <vcl.h>
#pragma hdrstop
#include <tchar.h>
//---------------------------------------------------------------------------

// Auto-create ONLY MainMenu
USEFORM("GUI\Login.cpp", LoginForm);
USEFORM("GUI\Main.cpp", MainForm);
USEFORM("GUI\RegisterForm.cpp", Register);
USEFORM("GUI\CustomerDashboard.cpp", UserDashboard);
USEFORM("GUI\AddComponent.cpp", Form7);
USEFORM("GUI\AdminDashboard.cpp", Form5);
USEFORM("GUI\BrowseComp.cpp", BrowseComponents);
USEFORM("GUI\ViewCart.cpp", Form8);
USEFORM("GUI\AddinCart.cpp", AddToCart);
USEFORM("GUI\CheckOut.cpp", CheckOutForm);
//---------------------------------------------------------------------------
#include "GUI/Main.h"
#include "models/PortalManager.h"

// Global backend object
PortalManager store;

//---------------------------------------------------------------------------
int WINAPI _tWinMain(HINSTANCE, HINSTANCE, LPTSTR, int)
{
    try
    {
        Application->Initialize();
        Application->MainFormOnTaskBar = true;

        // Load backend data BEFORE GUI starts
        store.loadUsers();
        store.loadComponents();
        store.loadOrders();

		Application->CreateForm(__classid(TMainForm), &MainForm);
		Application->CreateForm(__classid(TLoginForm), &LoginForm);
		Application->CreateForm(__classid(TBrowseComponents), &BrowseComponents);
		Application->CreateForm(__classid(TUserDashboard), &UserDashboard);
		Application->CreateForm(__classid(TRegister), &Register);
		Application->CreateForm(__classid(TAddToCart), &AddToCart);
		Application->CreateForm(__classid(TForm5), &Form5);
		Application->CreateForm(__classid(TCheckOutForm), &CheckOutForm);
		Application->Run();

        // Save backend data on exit
        store.saveUsers();
        store.saveComponents();
        store.saveOrders();
    }
    catch (Exception &exception)
    {
        Application->ShowException(&exception);
    }
    catch (...)
    {
        try
        {
            throw Exception("");
        }
        catch (Exception &exception)
        {
            Application->ShowException(&exception);
        }
    }
    return 0;
}
//---------------------------------------------------------------------------

