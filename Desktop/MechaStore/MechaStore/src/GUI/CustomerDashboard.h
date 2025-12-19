#ifndef CustomerDashboardH
#define CustomerDashboardH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>
#include <vector>

#include "../models/User.h"
#include "../models/OrderItem.h"   // ✅ FIX

class TUserDashboard : public TForm
{
__published:
    TButton *browseComponents;
    TButton *AddComponent;
    TButton *AddtoCart;
    TButton *ViewCart;
    TButton *CheckOut;
    TButton *LogOut;

    void __fastcall browseComponentsClick(TObject *Sender);
    void __fastcall AddComponentClick(TObject *Sender);
    void __fastcall AddtoCartClick(TObject *Sender);
    void __fastcall ViewCartClick(TObject *Sender);
    void __fastcall CheckOutClick(TObject *Sender);
    void __fastcall LogOutClick(TObject *Sender);

private:
    User *loggedInUser;
    std::vector<OrderItem> cartItems;

public:
    __fastcall TUserDashboard(TComponent* Owner, User* u);
    void __fastcall dashboardClose(TObject *Sender, TCloseAction &Action);
};

#endif

