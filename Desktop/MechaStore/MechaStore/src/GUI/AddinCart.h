#ifndef AddinCartH
#define AddinCartH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>
#include <vector>
#include "../models/User.h"
#include "../models/OrderItem.h"

class TAddToCartForm : public TForm
{
__published:
    TComboBox *Components;
    TEdit *Quantity;
    TButton *Add;
    TMemo *Preview;

    void __fastcall FormShow(TObject *Sender);
    void __fastcall AddClick(TObject *Sender);

private:
    User *loggedInUser;
    std::vector<OrderItem> &userCart;  // reference to dashboard cart

    void refreshPreview();

public:
    __fastcall TAddToCartForm(TComponent* Owner, User *u, std::vector<OrderItem> &cart);
};

#endif

