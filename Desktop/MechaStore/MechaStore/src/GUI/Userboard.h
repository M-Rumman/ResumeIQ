//---------------------------------------------------------------------------

#ifndef UserboardH
#define UserboardH
//---------------------------------------------------------------------------
#include <System.Classes.hpp>
#include <Vcl.Controls.hpp>
#include <Vcl.StdCtrls.hpp>
#include <Vcl.Forms.hpp>
//---------------------------------------------------------------------------
class TUserDashboard : public TForm
{
__published:	// IDE-managed Components
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
private:	// User declarations
public:		// User declarations
    PortalManager store;
	__fastcall TUserDashboard(TComponent* Owner);
};
//---------------------------------------------------------------------------
extern PACKAGE TUserDashboard *UserDashboard;
//---------------------------------------------------------------------------
#endif
