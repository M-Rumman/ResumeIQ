//---------------------------------------------------------------------------

#include <vcl.h>
#pragma hdrstop
#include <tchar.h>
//---------------------------------------------------------------------------

// Auto-create ONLY MainMenu
USEFORM("GUI/Main.cpp", MainForm);

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

