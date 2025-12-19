#ifndef CheckOutH
#define CheckOutH

#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>
#include <vector>

#include "../models/OrderItem.h"

class TCheckOutForm : public TForm
{
__published:
    TMemo *Summary;
    TLabel *Total;
    TButton *Cancel;
    TButton *Confirm;

    void __fastcall CancelClick(TObject *Sender);
    void __fastcall ConfirmClick(TObject *Sender);

private:
    std::vector<OrderItem> cartItems;
    bool orderPlaced = false;

public:
    __fastcall TCheckOutForm(TComponent* Owner);
    void setCartItems(const std::vector<OrderItem> &items);
    bool isOrderPlaced() const { return orderPlaced; }
};

#endif

